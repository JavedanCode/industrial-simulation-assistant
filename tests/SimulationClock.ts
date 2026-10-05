import { SimulationClock } from "../src/simulation/SimulationClock";

const clock = new SimulationClock();

console.log("Initial time:", clock.getTime());

clock.advanceTime(5);
console.log("After 5 minutes:", clock.getTime());

clock.advanceTime(2.5);
console.log("After another 2.5 minutes:", clock.getTime());
