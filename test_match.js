const value = "Full-time";
const cleanVal = (v) => (v || '').toLowerCase().replace(/[\s\-]/g, '');

const searchVal = cleanVal(value);
console.log("searchVal:", searchVal);

const optValue = "Full-time";
const optVal = optValue.toLowerCase().replace(/[\s\-]/g, '');
console.log("optVal:", optVal);

console.log("Condition 1:", optVal === searchVal);
console.log("Condition 2:", value.length > 2 && optVal.includes(searchVal));
console.log("Condition 3:", optVal.length > 2 && searchVal.includes(optVal));

console.log("Matched option data-value:", "Full-time".toLowerCase() === optValue.toLowerCase());

