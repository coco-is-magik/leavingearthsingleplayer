// Explicit prototype scenario data; see README for rules coverage.
export const PARTS = {
  juno: { name: 'Juno', mass: 1, cost: 1, thrust: 4, tech: 'juno' },
  atlas: { name: 'Atlas', mass: 4, cost: 5, thrust: 27, tech: 'atlas' },
  soyuz: { name: 'Soyuz', mass: 9, cost: 8, thrust: 80, tech: 'soyuz' },
  saturn: { name: 'Saturn', mass: 20, cost: 15, thrust: 200, tech: 'saturn' },
  probe: { name: 'Probe', mass: 1, cost: 2 },
  capsule: { name: 'Capsule', mass: 2, cost: 3 },
  astronaut: { name: 'Astronaut', mass: 1, cost: 5 },
  supplies: { name: 'Supplies', mass: 1, cost: 1 },
  sample: { name: 'Surface sample', mass: 1, cost: 0 }
};
export const TECH = { juno: 'Juno rockets', atlas: 'Atlas rockets', soyuz: 'Soyuz rockets', saturn: 'Saturn rockets', landing: 'Landing', reentry: 'Reentry', life: 'Life support' };
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