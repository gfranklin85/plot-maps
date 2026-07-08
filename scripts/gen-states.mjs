import { readFileSync, writeFileSync } from 'fs';
import { feature } from 'topojson-client';

// us-atlas states-10m is ALREADY projected (d3.geoAlbersUsa) into a 975x610
// plane — coordinates are plane x/y, not lon/lat. Pass them straight through.
const topo = JSON.parse(readFileSync('public/geo/us-states-10m.json', 'utf8'));
const fc = feature(topo, topo.objects.states);

const FIPS = {
'01':['AL','Alabama'],'02':['AK','Alaska'],'04':['AZ','Arizona'],'05':['AR','Arkansas'],'06':['CA','California'],'08':['CO','Colorado'],'09':['CT','Connecticut'],'10':['DE','Delaware'],'11':['DC','District of Columbia'],'12':['FL','Florida'],'13':['GA','Georgia'],'15':['HI','Hawaii'],'16':['ID','Idaho'],'17':['IL','Illinois'],'18':['IN','Indiana'],'19':['IA','Iowa'],'20':['KS','Kansas'],'21':['KY','Kentucky'],'22':['LA','Louisiana'],'23':['ME','Maine'],'24':['MD','Maryland'],'25':['MA','Massachusetts'],'26':['MI','Michigan'],'27':['MN','Minnesota'],'28':['MS','Mississippi'],'29':['MO','Missouri'],'30':['MT','Montana'],'31':['NE','Nebraska'],'32':['NV','Nevada'],'33':['NH','New Hampshire'],'34':['NJ','New Jersey'],'35':['NM','New Mexico'],'36':['NY','New York'],'37':['NC','North Carolina'],'38':['ND','North Dakota'],'39':['OH','Ohio'],'40':['OK','Oklahoma'],'41':['OR','Oregon'],'42':['PA','Pennsylvania'],'44':['RI','Rhode Island'],'45':['SC','South Carolina'],'46':['SD','South Dakota'],'47':['TN','Tennessee'],'48':['TX','Texas'],'49':['UT','Utah'],'50':['VT','Vermont'],'51':['VA','Virginia'],'53':['WA','Washington'],'54':['WV','West Virginia'],'55':['WI','Wisconsin'],'56':['WY','Wyoming']
};

// The atlas coords are raw lon/lat. Project equirectangular into a
// 975x610 viewBox tuned to CONUS + inset AK/HI (same scheme as the
// Connection Board). AK/HI are scaled down and tucked bottom-left.
function project(lon,lat){
  if(lat>50 || (lat>50 && lon<-129)){     // Alaska inset
    // Aleutians wrap past +180; fold them back so the chain stays put.
    let al = lon > 0 ? lon - 360 : lon;
    if(al < -190) al = -190;               // clamp the far tail
    return [ 70 + (al+190)*2.1, 505 + (64-lat)*2.6 ];
  }
  if(lat<24 && lon<-150){                  // Hawaii inset
    return [ 250 + (lon+160)*6.0, 545 + (22-lat)*6.0 ];
  }
  // CONUS: lon -125..-66.5 -> x 40..935 ; lat 49.5..24.5 -> y 30..580
  const x = 40 + (lon + 125) * (895/58.5);
  const y = 30 + (49.5 - lat) * (550/25);
  return [x,y];
}
function ringToPath(ring){
  let d='';
  for(let i=0;i<ring.length;i++){
    const [x,y]=project(ring[i][0],ring[i][1]);
    d += (i===0?'M':'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }
  return d+'Z';
}
function geomToPath(g){
  const polys = g.type==='Polygon' ? [g.coordinates] : g.coordinates;
  let d='';
  for(const poly of polys) for(const ring of poly) d+=ringToPath(ring);
  return d;
}

const out=[];
for(const f of fc.features){
  const id=String(f.id).padStart(2,'0');
  const meta=FIPS[id];
  if(!meta) continue;
  out.push({abbr:meta[0],name:meta[1],d:geomToPath(f.geometry)});
}
out.sort((a,b)=>a.name.localeCompare(b.name));

const header='// AUTO-GENERATED from us-atlas states-10m via scripts/gen-states.mjs — do not edit by hand.\n// Coordinates are the atlas\'s pre-projected (Albers USA) 975x610 plane.\n';
const body='export const US_VIEWBOX = "0 0 975 610";\nexport interface StatePath { abbr: string; name: string; d: string }\nexport const US_STATES: StatePath[] = '+JSON.stringify(out)+';\n';
writeFileSync('src/lib/geo/usStates.ts', header+body);
console.log('states:', out.length, 'bytes:', (header+body).length);
