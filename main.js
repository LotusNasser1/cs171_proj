/* ---------- Step metadata (1:1 with panels) ---------- */
const stepsData = [
  { title:'The American Dream?',     type:'title',   correlation:0,     axisX:'' },
  { title:'The Myth of Job Growth',  type:'scatter', correlation: 0.05, color:'#8b2e2e', axisX:'Job growth (%)' },
  { title:"Higher Wages Aren't Enough", type:'scatter', correlation: 0.08, color:'#8b2e2e', axisX:'Wage growth (%)' },
  { title:"GDP Doesn't Predict Mobility", type:'scatter', correlation: 0.12, color:'#8b2e2e', axisX:'GDP per capita ($)' },
  { title:'The Reality: Poverty Matters', type:'scatter', correlation:-0.55, color:'#8b2e2e', axisX:'Poverty rate (%)' },
  { title:'Education Opens Doors',   type:'scatter', correlation: 0.52, color:'#1a5f4a', axisX:'Adults with college degree (%)' },
  { title:'Family Stability',        type:'scatter', correlation: 0.48, color:'#1a5f4a', axisX:'Two-parent households (%)' },
  { title:'Environmental Justice',   type:'scatter', correlation:-0.42, color:'#8b2e2e', axisX:'PM2.5 (μg/m³)' },
  { title:'Community Roots',         type:'scatter', correlation: 0.36, color:'#1a5f4a', axisX:'Homeownership (%)' },
  { title:'The Rent Paradox',        type:'scatter', correlation: 0.44, color:'#8b5a2b', axisX:'Median rent ($)' },
  { title:'Opportunity Bargains Exist', type:'scatter', correlation: 0.44, color:'#8b5a2b', axisX:'Median rent ($)' },
  { title:"Rent's Moderate Impact",  type:'scatter', correlation: 0.36, color:'#1a5f4a', axisX:'Rent level (percentile)' }
];

/* ---------- SVG setup ---------- */
const svg = d3.select("#viz-svg");
const margin = { top:80, right:60, bottom:70, left:70 };
let width, height, chartWidth, chartHeight;

function updateDimensions(){
  const el = document.getElementById('viz-svg');
  width = el.clientWidth; height = el.clientHeight;
  chartWidth  = Math.max(0, width  - margin.left - margin.right);
  chartHeight = Math.max(0, height - margin.top  - margin.bottom);
}
updateDimensions();

const chartGroup = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
const xScale = d3.scaleLinear().domain([0,100]).range([0, chartWidth]);
const yScale = d3.scaleLinear().domain([-60,60]).range([chartHeight, 0]);

const xAxisGroup = chartGroup.append("g").attr("class","x-axis").attr("transform", `translate(0,${chartHeight})`);
const yAxisGroup = chartGroup.append("g").attr("class","y-axis");

const xLabel = chartGroup.append("text")
  .attr("class","x-label").attr("text-anchor","middle")
  .attr("x", chartWidth/2).attr("y", chartHeight+50)
  .style("font-size","16px").style("font-family","'Garamond','Georgia',serif").style("fill","#2c1810").style("font-weight","600");

const yLabel = chartGroup.append("text")
  .attr("class","y-label").attr("text-anchor","middle")
  .attr("transform","rotate(-90)").attr("x", -chartHeight/2).attr("y", -50)
  .style("font-size","16px").style("font-family","'Garamond','Georgia',serif").style("fill","#2c1810").style("font-weight","600")
  .text("Economic Mobility Index");

const correlationText = chartGroup.append("text")
  .attr("class","correlation-display").attr("x", chartWidth/2).attr("y", -35).attr("text-anchor","middle")
  .style("font-size","42px").style("font-family","'Garamond','Georgia',serif").style("font-weight","bold").style("opacity",0);

/* ---------- Deterministic, cached data per step ---------- */
const cachedData = new Map();

function mulberry32(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashInt(str){
  let h = 2166136261;
  for (let i=0; i<str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h|0;
}
function boxMuller(prng){
  const u1 = Math.max(Number.MIN_VALUE, prng());
  const u2 = prng();
  const R = Math.sqrt(-2 * Math.log(u1));
  const theta = 2 * Math.PI * u2;
  return R * Math.cos(theta);
}
function generateCorrelatedData(r, n, seed){
  const prng = mulberry32(seed);
  const X=[],Y=[];
  for (let i=0;i<n;i++){
    const z1 = boxMuller(prng);
    const z2 = boxMuller(prng);
    const x  = z1;
    const y  = r * z1 + Math.sqrt(1 - r*r) * z2;
    X.push(x); Y.push(y);
  }
  const mean = a => a.reduce((s,v)=>s+v,0)/a.length;
  const std  = (a,m) => Math.sqrt(a.reduce((s,v)=>s+(v-m)*(v-m),0)/a.length) || 1;
  const mx = mean(X), my = mean(Y);
  const sx = std(X,mx), sy = std(Y,my);
  const Xz = X.map(v => (v-mx)/sx);
  const Yz = Y.map(v => (v-my)/sy);
  const minX = Math.min(...Xz), maxX = Math.max(...Xz);
  const minY = Math.min(...Yz), maxY = Math.max(...Yz);
  const data = [];
  for (let i=0;i<n;i++){
    const xScaled = ((Xz[i]-minX)/(maxX-minX))*100;     // [0,100]
    const yScaled = ((Yz[i]-minY)/(maxY-minY))*120 - 60;// [-60,60]
    data.push({x:xScaled,y:yScaled});
  }
  return data;
}
function regressionLine(data){
  const n=data.length;
  let sumX=0,sumY=0,sumXY=0,sumX2=0;
  for (const p of data){ sumX+=p.x; sumY+=p.y; sumXY+=p.x*p.y; sumX2+=p.x*p.x; }
  const slope = (n*sumXY - sumX*sumY)/(n*sumX2 - sumX*sumX);
  const intercept = (sumY - slope*sumX)/n;
  return [{x:0,y:intercept},{x:100,y:slope*100 + intercept}];
}

const vizPanel = document.getElementById('visualization');
function setVizVisible(on){ vizPanel.classList.toggle('hidden', !on); }

let currentStep = -1;

function updateVisualization(stepIndex){
  const step = stepsData[stepIndex];

  xScale.range([0, chartWidth]);
  yScale.range([chartHeight, 0]);

  if (!step || step.type === 'title'){
    setVizVisible(false);
    chartGroup.selectAll(".dot").remove();
    chartGroup.selectAll(".regression-line").remove();
    correlationText.transition().duration(200).style("opacity",0);
    xAxisGroup.transition().duration(200).style("opacity",0);
    yAxisGroup.transition().duration(200).style("opacity",0);
    xLabel.transition().duration(200).style("opacity",0);
    yLabel.transition().duration(200).style("opacity",0);
    return;
  }

  setVizVisible(true);

  const xAxis = d3.axisBottom(xScale).ticks(5);
  const yAxis = d3.axisLeft(yScale).ticks(5);
  xAxisGroup.transition().duration(450).style("opacity",1).call(xAxis)
    .attr("transform", `translate(0,${chartHeight})`);
  yAxisGroup.transition().duration(450).style("opacity",1).call(yAxis);

  xAxisGroup.selectAll("line, path").style("stroke","#8b5a2b").style("stroke-width","2px");
  yAxisGroup.selectAll("line, path").style("stroke","#8b5a2b").style("stroke-width","2px");
  xAxisGroup.selectAll("text").style("fill","#2c1810").style("font-family","'Garamond','Georgia',serif").style("font-size","13px");
  yAxisGroup.selectAll("text").style("fill","#2c1810").style("font-family","'Garamond','Georgia',serif").style("font-size","13px");

  xLabel.transition().duration(450)
    .style("opacity",1)
    .attr("x", chartWidth/2)
    .attr("y", chartHeight + 50)
    .text(step.axisX || step.title);
  yLabel.transition().duration(450).style("opacity",1);

  // deterministic data per step (cached)
  let data = cachedData.get(stepIndex);
  if (!data){
    const seed = hashInt(step.title + '|' + step.correlation);
    data = generateCorrelatedData(step.correlation, 90, seed);
    cachedData.set(stepIndex, data);
  }
  const lineData = regressionLine(data);

  const corrStr = step.correlation >= 0 ? `+${step.correlation.toFixed(2)}` : step.correlation.toFixed(2);
  correlationText
    .transition().duration(450)
    .style("opacity",1).style("fill", step.color)
    .attr("x", chartWidth/2)
    .text(`r = ${corrStr}`);

  const lineGen = d3.line().x(d => xScale(d.x)).y(d => yScale(d.y));
  const line = chartGroup.selectAll(".regression-line").data([lineData]);
  line.exit().remove();
  line.enter().append("path").attr("class","regression-line")
    .merge(line)
    .transition().duration(700)
    .attr("d", lineGen)
    .style("fill","none").style("stroke", step.color).style("stroke-width",3).style("opacity",.75);

  const dots = chartGroup.selectAll(".dot").data(data, (d,i)=>i);
  dots.exit().transition().duration(200).attr("r",0).remove();
  const dotsEnter = dots.enter().append("circle")
    .attr("class","dot")
    .attr("cx", d => xScale(d.x)).attr("cy", d => yScale(d.y))
    .attr("r", 0)
    .style("fill", step.color).style("opacity", .55).style("stroke", step.color).style("stroke-width", 1.5);
  dotsEnter.merge(dots)
    .transition().duration(700).delay((d,i)=>i*5)
    .attr("cx", d => xScale(d.x)).attr("cy", d => yScale(d.y))
    .attr("r", 5)
    .style("fill", step.color).style("stroke", step.color);
}

/* ---------- Robust step activation (IntersectionObserver) ---------- */
const stepEls = Array.from(document.querySelectorAll('.step'));
const io = new IntersectionObserver((entries)=>{
  // pick the most visible intersecting step
  const visible = entries.filter(e => e.isIntersecting);
  if (visible.length === 0) return;

  visible.sort((a,b)=> b.intersectionRatio - a.intersectionRatio);
  const el = visible[0].target;
  const idx = parseInt(el.dataset.step, 10); // 0..7 maps directly to stepsData[0..7]

  // toggle active classes
  stepEls.forEach(s => s.classList.toggle('active', s === el));

  if (idx !== currentStep) {
    currentStep = idx;
    updateVisualization(idx);
  }
}, {
  root:null,
  threshold:[0.55, 0.6, 0.65, 0.7, 0.75] // switch when step is mostly in view
});

stepEls.forEach(el => io.observe(el));

// Hide viz entirely when no step is visible (e.g., outro fully on screen)
function hideIfNoStepVisible(){
  const anyVisible = stepEls.some(el => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const overlap = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    return overlap / Math.min(vh, r.height) >= 0.55;
  });
  setVizVisible(anyVisible && stepsData[currentStep] && stepsData[currentStep].type !== 'title');
}

window.addEventListener('scroll', hideIfNoStepVisible, { passive:true });

// Resize: recompute layout but DO NOT regenerate data
window.addEventListener('resize', () => {
  updateDimensions();
  updateVisualization(currentStep >= 0 ? currentStep : 0);
  hideIfNoStepVisible();
});

// Init (keep viz hidden at start)
currentStep = 0;            // first .step is the title card inside the stack
updateVisualization(currentStep);
hideIfNoStepVisible();

