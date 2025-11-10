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
  { title:'The Rent Paradox',        type:'bars',    correlation: 0.44, color:'#8b5a2b', axisX:'Rent Category' },
  { title:'Opportunity Bargains Exist', type:'bubble', correlation: 0.44, color:'#8b5a2b', axisX:'Monthly Rent ($)' },
  { title:"Rent's Moderate Impact",  type:'scatter', correlation: 0.36, color:'#1a5f4a', axisX:'Rent level (percentile)' },
  { title:'Geography of Opportunity', type:'title', correlation:0, axisX:'' },
  { title:'The Green Connection',   type:'maps',    correlation: 0.31, color:'#1a5f4a', axisX:'' },
  { title:'Regional Patterns Emerge', type:'maps',  correlation: 0.31, color:'#1a5f4a', axisX:'' }
];

/* ---------- SVG setup ---------- */
const svg = d3.select("#viz-svg");
const tip = d3.select('#tooltip');
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
    const xScaled = ((Xz[i]-minX)/(maxX-minX))*100;
    const yScaled = ((Yz[i]-minY)/(maxY-minY))*120 - 60;
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

function createBarData(){
  return [
    { category: 'Low Rent\nHigh Mobility', value: 28, color: '#1a5f4a', label: 'Opportunity\nBargains' },
    { category: 'Low Rent\nLow Mobility', value: 22, color: '#8b2e2e', label: 'Low Opportunity' },
    { category: 'High Rent\nHigh Mobility', value: 31, color: '#8b5a2b', label: 'Expected\nOutcome' },
    { category: 'High Rent\nLow Mobility', value: 19, color: '#cd7f32', label: 'Expensive but\nLimited' }
  ];
}

function createBubbleData(seed){
  const prng = mulberry32(seed);
  const bubbles = [];
  
  for (let i = 0; i < 50; i++){
    const rent = 500 + prng() * 2500;
    const mobility = 20 + prng() * 60;
    const population = 2000 + prng() * 8000;
    
    let color, quadrant;
    if (rent < 1500 && mobility > 50) {
      color = '#1a5f4a';
      quadrant = 'Low Rent, High Mobility';
    } else if (rent < 1500 && mobility <= 50) {
      color = '#8b2e2e';
      quadrant = 'Low Rent, Low Mobility';
    } else if (rent >= 1500 && mobility > 50) {
      color = '#8b5a2b';
      quadrant = 'High Rent, High Mobility';
    } else {
      color = '#cd7f32';
      quadrant = 'High Rent, Low Mobility';
    }
    
    bubbles.push({ rent, mobility, population, color, quadrant });
  }
  
  return bubbles;
}

/* ---------- Map data and setup ---------- */
let mapData = null;

// Load and process the atlas data
d3.csv('atlas.csv').then(data => {
  console.log("Atlas data loaded, rows:", data.length);
  
  const FIPS2USPS = new Map([
    [1,'AL'],[2,'AK'],[4,'AZ'],[5,'AR'],[6,'CA'],[8,'CO'],[9,'CT'],[10,'DE'],[11,'DC'],[12,'FL'],[13,'GA'],
    [15,'HI'],[16,'ID'],[17,'IL'],[18,'IN'],[19,'IA'],[20,'KS'],[21,'KY'],[22,'LA'],[23,'ME'],[24,'MD'],
    [25,'MA'],[26,'MI'],[27,'MN'],[28,'MS'],[29,'MO'],[30,'MT'],[31,'NE'],[32,'NV'],[33,'NH'],[34,'NJ'],
    [35,'NM'],[36,'NY'],[37,'NC'],[38,'ND'],[39,'OH'],[40,'OK'],[41,'OR'],[42,'PA'],[44,'RI'],[45,'SC'],
    [46,'SD'],[47,'TN'],[48,'TX'],[49,'UT'],[50,'VT'],[51,'VA'],[53,'WA'],[54,'WV'],[55,'WI'],[56,'WY']
  ]);
  
  const fips2code = id => FIPS2USPS.get(+id) || null;
  
  const states = d3.rollup(data,
    v => ({
      vegetation: d3.mean(v, d => +d.vegetation),
      mobility: d3.mean(v, d => +d.kfr_pooled_pooled_p25)
    }),
    d => fips2code(+d.state)
  );
  
  const vegMap = new Map();
  const mobMap = new Map();
  
  for(const [s, v] of states){ 
    if(s && v.vegetation != null && v.mobility != null){
      vegMap.set(s, v.vegetation); 
      mobMap.set(s, v.mobility);
    } 
  }
  
  mapData = { vegMap, mobMap };
  console.log("Map data processed. States:", vegMap.size);
}).catch(err => {
  console.error("Error loading atlas.csv:", err);
});

function drawMaps(){
  // Clear existing content but keep axes groups
  chartGroup.selectAll(".state-veg").remove();
  chartGroup.selectAll(".state-mob").remove();
  chartGroup.selectAll("g.veg-group").remove();
  chartGroup.selectAll("g.mob-group").remove();
  
  if (!mapData) {
    console.log("Map data not loaded yet");
    return;
  }
  
  // Set up for side-by-side maps - LARGER SIZE
  const mapWidth = chartWidth / 2 - 40;
  const mapHeight = chartHeight - 20;
  
  // Projection setup - adjusted for better fit with LARGER SCALE
  const projectionVeg = d3.geoAlbersUsa()
    .translate([mapWidth/2, mapHeight/2])
    .scale(mapWidth * 1.3);
  
  const projectionMob = d3.geoAlbersUsa()
    .translate([mapWidth/2, mapHeight/2])
    .scale(mapWidth * 1.3);
  
  const pathVeg = d3.geoPath(projectionVeg);
  const pathMob = d3.geoPath(projectionMob);
  
  // Color scales
  const colorVeg = d3.scaleSequential(d3.interpolateGreens);
  const colorMob = d3.scaleSequential(d3.interpolateBlues);
  
  const vegVals = Array.from(mapData.vegMap.values()).filter(Number.isFinite);
  const mobVals = Array.from(mapData.mobMap.values()).filter(Number.isFinite);
  
  colorVeg.domain([d3.min(vegVals), d3.max(vegVals)]);
  colorMob.domain([d3.min(mobVals), d3.max(mobVals)]);
  
  // Create two map groups
  const vegGroup = chartGroup.append("g")
    .attr("class", "veg-group")
    .attr("transform", `translate(0, 20)`);
  
  const mobGroup = chartGroup.append("g")
    .attr("class", "mob-group")
    .attr("transform", `translate(${mapWidth + 60}, 20)`);
  
  // Add titles
  vegGroup.append("text")
    .attr("x", mapWidth/2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-family", "'Garamond','Georgia',serif")
    .style("fill", "#2c1810")
    .style("font-weight", "600")
    .text("Vegetation");
  
  mobGroup.append("text")
    .attr("x", mapWidth/2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-family", "'Garamond','Georgia',serif")
    .style("fill", "#2c1810")
    .style("font-weight", "600")
    .text("Economic Mobility");
  
  // FIPS to state code mapping
  const FIPS2USPS = new Map([
    [1,'AL'],[2,'AK'],[4,'AZ'],[5,'AR'],[6,'CA'],[8,'CO'],[9,'CT'],[10,'DE'],[11,'DC'],[12,'FL'],[13,'GA'],
    [15,'HI'],[16,'ID'],[17,'IL'],[18,'IN'],[19,'IA'],[20,'KS'],[21,'KY'],[22,'LA'],[23,'ME'],[24,'MD'],
    [25,'MA'],[26,'MI'],[27,'MN'],[28,'MS'],[29,'MO'],[30,'MT'],[31,'NE'],[32,'NV'],[33,'NH'],[34,'NJ'],
    [35,'NM'],[36,'NY'],[37,'NC'],[38,'ND'],[39,'OH'],[40,'OK'],[41,'OR'],[42,'PA'],[44,'RI'],[45,'SC'],
    [46,'SD'],[47,'TN'],[48,'TX'],[49,'UT'],[50,'VT'],[51,'VA'],[53,'WA'],[54,'WV'],[55,'WI'],[56,'WY']
  ]);
  const fips2code = id => FIPS2USPS.get(+id) || null;
  
  // Load and draw maps
  d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json').then(us => {
    const states = topojson.feature(us, us.objects.states).features;
    const mesh = topojson.mesh(us, us.objects.states, (a,b) => a !== b);
    
    // Vegetation map
    vegGroup.selectAll('.state-veg')
      .data(states)
      .join('path')
      .attr('class', 'state-veg')
      .attr('d', pathVeg)
      .attr('fill', d => {
        const v = mapData.vegMap.get(fips2code(d.id));
        return Number.isFinite(v) ? colorVeg(v) : '#ddd';
      })
      .attr('stroke', '#2c1810')
      .attr('stroke-width', 0.5)
      .attr('stroke-opacity', 0.4)
      .style('opacity', 0)
      .on('mouseenter', function(event, d) {
        d3.select(this).attr('stroke-width', 1.5).attr('stroke-opacity', 0.85);
        const code = fips2code(d.id);
        const veg = mapData.vegMap.get(code);
        const mob = mapData.mobMap.get(code);
        tip.style('display', 'block')
          .html(`<b>${code}</b><br/>Vegetation: ${Number.isFinite(veg) ? d3.format('.3f')(veg) : 'N/A'}<br/>Mobility: ${Number.isFinite(mob) ? d3.format('.1f')(mob) : 'N/A'}`);
      })
      .on('mousemove', event => {
        tip.style('left', `${event.clientX}px`).style('top', `${event.clientY}px`);
      })
      .on('mouseleave', function() {
        d3.select(this).attr('stroke-width', 0.5).attr('stroke-opacity', 0.4);
        tip.style('display', 'none');
      })
      .transition().duration(700).delay((d,i) => i * 10)
      .style('opacity', 1);
    
    // Add borders for vegetation map
    vegGroup.append('path')
      .attr('d', pathVeg(mesh))
      .attr('fill', 'none')
      .attr('stroke', '#2c1810')
      .attr('stroke-width', 0.7);
    
    // Mobility map
    mobGroup.selectAll('.state-mob')
      .data(states)
      .join('path')
      .attr('class', 'state-mob')
      .attr('d', pathMob)
      .attr('fill', d => {
        const v = mapData.mobMap.get(fips2code(d.id));
        return Number.isFinite(v) ? colorMob(v) : '#ddd';
      })
      .attr('stroke', '#2c1810')
      .attr('stroke-width', 0.5)
      .attr('stroke-opacity', 0.4)
      .style('opacity', 0)
      .on('mouseenter', function(event, d) {
        d3.select(this).attr('stroke-width', 1.5).attr('stroke-opacity', 0.85);
        const code = fips2code(d.id);
        const veg = mapData.vegMap.get(code);
        const mob = mapData.mobMap.get(code);
        tip.style('display', 'block')
          .html(`<b>${code}</b><br/>Vegetation: ${Number.isFinite(veg) ? d3.format('.3f')(veg) : 'N/A'}<br/>Mobility: ${Number.isFinite(mob) ? d3.format('.1f')(mob) : 'N/A'}`);
      })
      .on('mousemove', event => {
        tip.style('left', `${event.clientX}px`).style('top', `${event.clientY}px`);
      })
      .on('mouseleave', function() {
        d3.select(this).attr('stroke-width', 0.5).attr('stroke-opacity', 0.4);
        tip.style('display', 'none');
      })
      .transition().duration(700).delay((d,i) => i * 10)
      .style('opacity', 1);
    
    // Add borders for mobility map
    mobGroup.append('path')
      .attr('d', pathMob(mesh))
      .attr('fill', 'none')
      .attr('stroke', '#2c1810')
      .attr('stroke-width', 0.7);
      
    console.log("Maps drawn successfully");
  }).catch(err => {
    console.error("Error loading US map data:", err);
  });
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
    chartGroup.selectAll(".bar").remove();
    chartGroup.selectAll(".bar-label").remove();
    chartGroup.selectAll(".bubble").remove();
    chartGroup.selectAll(".quadrant-line").remove();
    chartGroup.selectAll(".state-veg").remove();
    chartGroup.selectAll(".state-mob").remove();
    chartGroup.selectAll("g.veg-group").remove();
    chartGroup.selectAll("g.mob-group").remove();
    correlationText.transition().duration(200).style("opacity",0);
    xAxisGroup.transition().duration(200).style("opacity",0);
    yAxisGroup.transition().duration(200).style("opacity",0);
    xLabel.transition().duration(200).style("opacity",0);
    yLabel.transition().duration(200).style("opacity",0);
    return;
  }

  setVizVisible(true);

  // Handle map type
  if (step.type === 'maps'){
    // Hide other elements
    chartGroup.selectAll(".dot").transition().duration(300).attr("r",0).remove();
    chartGroup.selectAll(".regression-line").transition().duration(300).style("opacity",0).remove();
    chartGroup.selectAll(".bar").transition().duration(300).attr("height",0).remove();
    chartGroup.selectAll(".bar-label").transition().duration(300).style("opacity",0).remove();
    chartGroup.selectAll(".bubble").transition().duration(300).attr("r",0).remove();
    chartGroup.selectAll(".quadrant-line").transition().duration(300).style("opacity",0).remove();
    
    // Hide axes and labels for maps
    xAxisGroup.transition().duration(300).style("opacity",0);
    yAxisGroup.transition().duration(300).style("opacity",0);
    xLabel.transition().duration(300).style("opacity",0);
    yLabel.transition().duration(300).style("opacity",0);
    
    // Show correlation
    const corrStr = step.correlation >= 0 ? `+${step.correlation.toFixed(2)}` : step.correlation.toFixed(2);
    correlationText
      .transition().duration(450)
      .style("opacity",1)
      .style("fill", step.color)
      .attr("x", chartWidth/2)
      .text(`r = ${corrStr}`);
    
    // Draw the maps
    drawMaps();
    return;
  }

  // Handle bar chart type
  if (step.type === 'bars'){
    // Hide other elements
    chartGroup.selectAll(".dot").transition().duration(300).attr("r",0).remove();
    chartGroup.selectAll(".regression-line").transition().duration(300).style("opacity",0).remove();
    chartGroup.selectAll(".bubble").transition().duration(300).attr("r",0).remove();
    chartGroup.selectAll(".quadrant-line").transition().duration(300).style("opacity",0).remove();
    chartGroup.selectAll(".state-veg").transition().duration(300).style("opacity",0).remove();
    chartGroup.selectAll(".state-mob").transition().duration(300).style("opacity",0).remove();
    chartGroup.selectAll("g.veg-group").remove();
    chartGroup.selectAll("g.mob-group").remove();
    
    const barData = createBarData();
    
    // Set up scales for bars
    const xBarScale = d3.scaleBand()
      .domain(barData.map(d => d.category))
      .range([0, chartWidth])
      .padding(0.3);
    
    const yBarScale = d3.scaleLinear()
      .domain([0, 35])
      .range([chartHeight, 0]);
    
    // Update axes
    const xAxis = d3.axisBottom(xBarScale).tickFormat(d => d.replace('\n', ' '));
    const yAxis = d3.axisLeft(yBarScale).ticks(5);
    
    xAxisGroup.transition().duration(450).style("opacity",1).call(xAxis)
      .attr("transform", `translate(0,${chartHeight})`);
    yAxisGroup.transition().duration(450).style("opacity",1).call(yAxis);
    
    xAxisGroup.selectAll("line, path").style("stroke","#8b5a2b").style("stroke-width","2px");
    yAxisGroup.selectAll("line, path").style("stroke","#8b5a2b").style("stroke-width","2px");
    xAxisGroup.selectAll("text")
      .style("fill","#2c1810")
      .style("font-family","'Garamond','Georgia',serif")
      .style("font-size","11px")
      .attr("transform", "rotate(-15)")
      .style("text-anchor", "end");
    yAxisGroup.selectAll("text").style("fill","#2c1810").style("font-family","'Garamond','Georgia',serif").style("font-size","13px");
    
    xLabel.transition().duration(450).style("opacity",0);
    
    yLabel.transition().duration(450)
      .style("opacity",1)
      .text("% of Neighborhoods");
    
    correlationText.transition().duration(450).style("opacity",0);
    
    // Draw bars
    const bars = chartGroup.selectAll(".bar").data(barData, d => d.category);
    
    bars.exit().transition().duration(300).attr("height", 0).attr("y", chartHeight).remove();
    
    const barsEnter = bars.enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => xBarScale(d.category))
      .attr("width", xBarScale.bandwidth())
      .attr("y", chartHeight)
      .attr("height", 0)
      .style("fill", d => d.color)
      .style("opacity", 0.8)
      .style("stroke", d => d.color)
      .style("stroke-width", 2);
    
    barsEnter.merge(bars)
      .transition().duration(700).delay((d,i) => i * 100)
      .attr("x", d => xBarScale(d.category))
      .attr("width", xBarScale.bandwidth())
      .attr("y", d => yBarScale(d.value))
      .attr("height", d => chartHeight - yBarScale(d.value))
      .style("fill", d => d.color);
    
    // Add value labels on bars
    const labels = chartGroup.selectAll(".bar-label").data(barData, d => d.category);
    
    labels.exit().transition().duration(300).style("opacity", 0).remove();
    
    const labelsEnter = labels.enter().append("text")
      .attr("class", "bar-label")
      .attr("x", d => xBarScale(d.category) + xBarScale.bandwidth() / 2)
      .attr("y", chartHeight)
      .attr("text-anchor", "middle")
      .style("font-family", "'Garamond','Georgia',serif")
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .style("fill", "#2c1810")
      .style("opacity", 0);
    
    labelsEnter.merge(labels)
      .transition().duration(700).delay((d,i) => i * 100 + 200)
      .attr("x", d => xBarScale(d.category) + xBarScale.bandwidth() / 2)
      .attr("y", d => yBarScale(d.value) - 8)
      .text(d => d.value + '%')
      .style("opacity", 1);
    
    return;
  }

  // Handle bubble chart type
  if (step.type === 'bubble'){
    // Hide other elements
    chartGroup.selectAll(".dot").transition().duration(300).attr("r",0).remove();
    chartGroup.selectAll(".regression-line").transition().duration(300).style("opacity",0).remove();
    chartGroup.selectAll(".bar").transition().duration(300).attr("height",0).remove();
    chartGroup.selectAll(".bar-label").transition().duration(300).style("opacity",0).remove();
    chartGroup.selectAll(".state-veg").transition().duration(300).style("opacity",0).remove();
    chartGroup.selectAll(".state-mob").transition().duration(300).style("opacity",0).remove();
    chartGroup.selectAll("g.veg-group").remove();
    chartGroup.selectAll("g.mob-group").remove();
    
    const bubbleData = createBubbleData(hashInt(step.title));
    
    // Set up scales for bubbles
    const xBubbleScale = d3.scaleLinear()
      .domain([400, 3100])
      .range([0, chartWidth]);
    
    const yBubbleScale = d3.scaleLinear()
      .domain([15, 85])
      .range([chartHeight, 0]);
    
    const sizeScale = d3.scaleSqrt()
      .domain([2000, 10000])
      .range([6, 25]);
    
    // Update axes
    const xAxis = d3.axisBottom(xBubbleScale).ticks(5).tickFormat(d => '$' + d);
    const yAxis = d3.axisLeft(yBubbleScale).ticks(5);
    
    xAxisGroup.transition().duration(450).style("opacity",1).call(xAxis)
      .attr("transform", `translate(0,${chartHeight})`);
    yAxisGroup.transition().duration(450).style("opacity",1).call(yAxis);
    
    xAxisGroup.selectAll("line, path").style("stroke","#8b5a2b").style("stroke-width","2px");
    yAxisGroup.selectAll("line, path").style("stroke","#8b5a2b").style("stroke-width","2px");
    xAxisGroup.selectAll("text")
      .style("fill","#2c1810")
      .style("font-family","'Garamond','Georgia',serif")
      .style("font-size","13px")
      .attr("transform", null)
      .style("text-anchor", "middle");
    yAxisGroup.selectAll("text").style("fill","#2c1810").style("font-family","'Garamond','Georgia',serif").style("font-size","13px");
    
    xLabel.transition().duration(450)
      .style("opacity",1)
      .attr("x", chartWidth/2)
      .attr("y", chartHeight + 50)
      .text(step.axisX);
    
    yLabel.transition().duration(450)
      .style("opacity",1)
      .text("Economic Mobility Score");
    
    correlationText.transition().duration(450).style("opacity",0);
    
    // Draw quadrant lines
    const midRent = xBubbleScale(1500);
    const midMobility = yBubbleScale(50);
    
    const quadrantLines = [
      { x1: midRent, y1: 0, x2: midRent, y2: chartHeight, dash: '5,5' },
      { x1: 0, y1: midMobility, x2: chartWidth, y2: midMobility, dash: '5,5' }
    ];
    
    const lines = chartGroup.selectAll(".quadrant-line").data(quadrantLines);
    lines.exit().remove();
    lines.enter().append("line")
      .attr("class", "quadrant-line")
      .merge(lines)
      .transition().duration(450)
      .attr("x1", d => d.x1)
      .attr("y1", d => d.y1)
      .attr("x2", d => d.x2)
      .attr("y2", d => d.y2)
      .style("stroke", "#8b5a2b")
      .style("stroke-width", 1.5)
      .style("stroke-dasharray", d => d.dash)
      .style("opacity", 0.4);
    
    // Draw bubbles
    const bubbles = chartGroup.selectAll(".bubble").data(bubbleData, (d,i) => i);
    
    bubbles.exit().transition().duration(300).attr("r", 0).remove();
    
    const bubblesEnter = bubbles.enter().append("circle")
      .attr("class", "bubble")
      .attr("cx", d => xBubbleScale(d.rent))
      .attr("cy", d => yBubbleScale(d.mobility))
      .attr("r", 0)
      .style("fill", d => d.color)
      .style("opacity", 0.6)
      .style("stroke", d => d.color)
      .style("stroke-width", 2);
    
    bubblesEnter.merge(bubbles)
      .transition().duration(700).delay((d,i) => i * 15)
      .attr("cx", d => xBubbleScale(d.rent))
      .attr("cy", d => yBubbleScale(d.mobility))
      .attr("r", d => sizeScale(d.population))
      .style("fill", d => d.color);
    
    return;
  }

  // Handle scatter plot type (existing code)
  chartGroup.selectAll(".bar").transition().duration(300).attr("height", 0).remove();
  chartGroup.selectAll(".bar-label").transition().duration(300).style("opacity", 0).remove();
  chartGroup.selectAll(".bubble").transition().duration(300).attr("r", 0).remove();
  chartGroup.selectAll(".quadrant-line").transition().duration(300).style("opacity", 0).remove();
  
  const xAxis = d3.axisBottom(xScale).ticks(5);
  const yAxis = d3.axisLeft(yScale).ticks(5);
  xAxisGroup.transition().duration(450).style("opacity",1).call(xAxis)
    .attr("transform", `translate(0,${chartHeight})`);
  yAxisGroup.transition().duration(450).style("opacity",1).call(yAxis);

  xAxisGroup.selectAll("line, path").style("stroke","#8b5a2b").style("stroke-width","2px");
  yAxisGroup.selectAll("line, path").style("stroke","#8b5a2b").style("stroke-width","2px");
  xAxisGroup.selectAll("text")
    .style("fill","#2c1810")
    .style("font-family","'Garamond','Georgia',serif")
    .style("font-size","13px")
    .attr("transform", null)
    .style("text-anchor", "middle");
  yAxisGroup.selectAll("text").style("fill","#2c1810").style("font-family","'Garamond','Georgia',serif").style("font-size","13px");

  xLabel.transition().duration(450)
    .style("opacity",1)
    .attr("x", chartWidth/2)
    .attr("y", chartHeight + 50)
    .text(step.axisX || step.title);
  
  yLabel.transition().duration(450)
    .style("opacity",1)
    .text("Economic Mobility Index");

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
  
  // Tooltip & hover for scatter dots
  const fmtX = d3.format('.1f');
  const fmtY = d3.format('.1f');
  const xName = step.axisX || step.title;
  const yName = "Economic Mobility Index";

  const dotsMerge = dotsEnter.merge(dots)
    .on('mouseenter', (event, p) => {
      d3.select(event.currentTarget)
        .attr('stroke-width', 3)
        .style('opacity', 0.9);

      tip
        .style('display', 'block')
        .html(
          `<b>${xName}</b>: ${fmtX(p.x)}<br>` +
          `<b>${yName}</b>: ${fmtY(p.y)}`
        );
    })
    .on('mousemove', (event) => {
      tip
        .style('left', `${event.clientX}px`)
        .style('top',  `${event.clientY}px`);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget)
        .attr('stroke-width', 1.5)
        .style('opacity', 0.55);

      tip.style('display', 'none');
    });

  dotsMerge
    .transition().duration(700).delay((d,i)=>i*5)
    .attr("cx", d => xScale(d.x)).attr("cy", d => yScale(d.y))
    .attr("r", 5)
    .style("fill", step.color).style("stroke", step.color);
}

/* ---------- Robust step activation (IntersectionObserver) ---------- */
const stepEls = Array.from(document.querySelectorAll('.step'));
const io = new IntersectionObserver((entries)=>{
  const visible = entries.filter(e => e.isIntersecting);
  if (visible.length === 0) return;

  visible.sort((a,b)=> b.intersectionRatio - a.intersectionRatio);
  const el = visible[0].target;
  const idx = parseInt(el.dataset.step, 10);

  stepEls.forEach(s => s.classList.toggle('active', s === el));

  if (idx !== currentStep) {
    currentStep = idx;
    updateVisualization(idx);
  }
}, {
  root:null,
  threshold:[0.55, 0.6, 0.65, 0.7, 0.75]
});

stepEls.forEach(el => io.observe(el));

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

window.addEventListener('resize', () => {
  updateDimensions();
  updateVisualization(currentStep >= 0 ? currentStep : 0);
  hideIfNoStepVisible();
});

currentStep = 0;
updateVisualization(currentStep);
hideIfNoStepVisible();