// Explicit prototype scenario data; see README for rules coverage.
export const PARTS = {
  juno: { name: 'Juno', mass: 1, cost: 1, thrust: 4, tech: 'juno' },
  atlas: { name: 'Atlas', mass: 4, cost: 5, thrust: 27, tech: 'atlas' },
  soyuz: { name: 'Soyuz', mass: 9, cost: 8, thrust: 80, tech: 'soyuz' },
  saturn: { name: 'Saturn', mass: 20, cost: 15, thrust: 200, tech: 'saturn' },
  probe: { name: 'Probe', mass: 1, cost: 2 },
  capsule: { name: 'Capsule', mass: 2, cost: 3, seats: 1 },
  astronaut: { name: 'Astronaut', mass: 1, cost: 5, crew: true },
  supplies: { name: 'Supplies', mass: 1, cost: 1 },
  sample: { name: 'Surface sample', mass: 1, cost: 0 }
};
export const TECH = { juno: 'Juno rockets', atlas: 'Atlas rockets', soyuz: 'Soyuz rockets', saturn: 'Saturn rockets', landing: 'Landing', reentry: 'Reentry', life: 'Life support', rendezvous: 'Rendezvous', proton: 'Proton rockets', aerobraking: 'Aerobraking', surveying: 'Surveying', shuttle: 'Space Shuttle', synthesis: 'Synthesis' };
export const PREREQUISITES = { proton: ['soyuz'], aerobraking: ['reentry'], synthesis: ['life'], shuttle: ['reentry','atlas'] };
export const TECH_EXPANSIONS = {proton:'outer',aerobraking:'outer',synthesis:'stations',shuttle:'stations'};
export const missingPrerequisites = (tech,key) => (PREREQUISITES[key]||[]).filter(k=>!Object.hasOwn(tech,k));
export function technologyClosure(keys) {
  const result=new Set(keys);
  for (const key of result) for (const prerequisite of PREREQUISITES[key]||[]) result.add(prerequisite);
  return [...result].sort();
}
// Expansion hardware prices, masses and route distances are scenario values,
// not a transcription of the printed component/location decks.
Object.assign(PARTS, {
  proton: { name: 'Proton', mass: 5, cost: 12, thrust: 100, tech: 'proton', expansion: 'outer' },
  galileo: { name: 'Galileo probe', mass: 2, cost: 5, shielded: true, expansion: 'outer' },
  explorer: { name: 'Explorer payload', mass: 1, cost: 3, expansion: 'outer' },
  scientist: { name: 'Scientist', mass: 1, cost: 5, crew: true, expansion: 'outer' },
  mechanic: { name: 'Mechanic', mass: 1, cost: 5, crew: true, expansion: 'stations' },
  habitat: { name: 'Space habitat', mass: 8, cost: 10, seats: 5, tech: 'synthesis', expansion: 'stations' },
  habitatParts: { name: 'Ground habitat parts', mass: 4, cost: 6, tech: 'synthesis', expansion: 'stations' },
  groundHabitat: { name: 'Ground habitat (immovable)', mass: 4, cost: 0, seats: 5, unbuyable: true, expansion: 'stations' },
  food: { name: 'Food (feeds five)', mass: 1, cost: 1, expansion: 'stations' },
  hydroponics: { name: 'Hydroponics module', mass: 3, cost: 5, tech: 'synthesis', expansion: 'stations' },
  generator: { name: 'Fuel generator', mass: 3, cost: 5, tech: 'synthesis', expansion: 'stations' },
  science: { name: 'Science module', mass: 3, cost: 5, expansion: 'stations' },
  experiment: { name: 'Ready experiment', mass: 1, cost: 2, expansion: 'stations' },
  finishedExperiment: { name: 'Finished experiment', mass: 1, cost: 0, unbuyable: true, expansion: 'stations' },
  shuttle: { name: 'Space Shuttle', mass: 10, cost: 15, thrust: 160, seats: 5, fuel: 'largeTank', tech: 'shuttle', expansion: 'stations' },
  daedalus: { name: 'Daedalus', mass: 1, cost: 3, thrust: 12, fuel: 'smallTank', tech: 'shuttle', expansion: 'stations' },
  smallTank: { name: 'Small fuel tank', mass: 1, cost: 1, expansion: 'stations' },
  largeTank: { name: 'Large fuel tank', mass: 5, cost: 3, expansion: 'stations' }
});
export const SURFACES = ['Moon', 'Mars', 'Venus', 'Io', 'Europa', 'Ganymede', 'Callisto', 'Titan', 'Enceladus'];
export const LOCATIONS = ['Earth', 'Earth orbit', 'Moon orbit', 'Moon', 'Mars orbit', 'Mars', 'Venus orbit', 'Venus'];
export const ROUTES = [
  ['Earth','Earth orbit',8,0], ['Earth orbit','Earth',0,0,'reentry'],
  ['Earth orbit','Moon orbit',3,0], ['Moon orbit','Earth orbit',3,0],
  ['Moon orbit','Moon',2,0,'landing'], ['Moon','Moon orbit',2,0],
  ['Earth orbit','Mars orbit',3,2], ['Mars orbit','Earth orbit',3,2],
  ['Mars orbit','Mars',2,0,'landing'], ['Mars','Mars orbit',3,0],
  ['Earth orbit','Venus orbit',3,1], ['Venus orbit','Earth orbit',3,1],
  ['Venus orbit','Venus',2,0,'landing'], ['Venus','Venus orbit',6,0]
].map(([from,to,difficulty,years,hazard],id)=>({id,from,to,difficulty,years,hazard}));
const outerRoutes = [
  ['Earth orbit','Jupiter fly-by',4,4], ['Jupiter fly-by','Jupiter orbit',4,0],
  ['Jupiter fly-by','Jupiter orbit',1,0,'aerobraking'],
  ['Jupiter fly-by','Saturn fly-by',3,3], ['Saturn fly-by','Saturn orbit',4,0],
  ['Saturn fly-by','Saturn orbit',1,0,'aerobraking'],
  ['Saturn fly-by','Uranus fly-by',3,5], ['Uranus fly-by','Neptune fly-by',3,6],
  ...['Io','Europa','Ganymede','Callisto'].flatMap(to=>[['Jupiter orbit',to,2,1,'landing'],[to,'Jupiter orbit',2,1]]),
  ...['Titan','Enceladus'].flatMap(to=>[['Saturn orbit',to,2,1,'landing'],[to,'Saturn orbit',2,1]])
];
for (const [from,to,difficulty,years,hazard] of outerRoutes) {
  ROUTES.push({id:ROUTES.length,from,to,difficulty,years,hazard,expansion:'outer'});
  for (const location of [from,to]) if (!LOCATIONS.includes(location)) LOCATIONS.push(location);
}
export const MISSIONS = [
  {id:'orbit',name:'Artificial satellite',location:'Earth orbit',points:1},
  {id:'lunar',name:'Lunar probe',location:'Moon',points:2},
  {id:'crew-orbit',name:'Human in orbit',location:'Earth orbit',crew:true,points:2},
  {id:'crew-moon',name:'Human on the Moon',location:'Moon',crew:true,points:4},
  {id:'mars',name:'Mars probe',location:'Mars',points:3},
  {id:'venus',name:'Venus probe',location:'Venus',points:3},
  {id:'sample',name:'Return a lunar sample',location:'Earth',sample:'Moon',points:4},
  {id:'return',name:'Bring a lunar astronaut home',location:'Earth',crew:true,visited:'Moon',points:5}
];
for (const location of ['Jupiter fly-by','Saturn fly-by','Uranus fly-by','Neptune fly-by',...SURFACES.slice(3)]) {
  MISSIONS.push({id:`outer-${location}`,name:`Explore ${location}`,location,points:3,expansion:'outer'});
}
MISSIONS.push({id:'station',name:'Occupied orbital habitat',location:'Earth orbit',crew:true,part:'habitat',points:4,expansion:'stations'});
export const enabled = (s, item) => !item.expansion || Boolean(s.expansions?.[item.expansion]);
export const missionsFor = s => MISSIONS.filter(m=>enabled(s,m));