export const sourceGroups = [
  {title:'Data types',recipes:['Number','Boolean','String','Vector','Matrix','Tensor']},
  {title:'Controls',recipes:['Slider','Selector','Button']},
  {title:'Data sources',recipes:['Text','CSV']},
];
export const sourceGroup=(recipe:string)=>sourceGroups.find(group=>group.recipes.includes(recipe))?.title;
