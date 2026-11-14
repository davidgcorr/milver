import { templates, type BlockData } from './model';
import { jsRecipes } from './js-recipes';
// Presentation comes from persisted kind/recipe, so JSON and every UI surface agree.
export function blockPresentation(data: Pick<BlockData, 'kind' | 'recipe' | 'operation'>) {
  const recipe = data.recipe ? jsRecipes[data.recipe] : undefined;
  const template = templates.find(template => template.kind === data.kind);
  let trail: string[];
  if (data.kind === 'javascript' || data.kind === 'compute' && recipe) {
    if (recipe && ['JavaScript datatypes', 'JavaScript sources'].includes(recipe.category)) trail = ['Sources', recipe.label];
    else if (recipe?.category === 'Operators') trail = ['Operators & functions', recipe.label];
    else if (recipe?.category === 'Sinks') trail = ['Sinks', recipe.label];
    else if (data.recipe === 'Iframe') trail = ['JavaScript', 'Iframe'];
    else if (data.recipe === 'WebAssembly') trail = ['JavaScript', 'WebAssembly'];
    else {
      trail = ['JavaScript', 'Module'];
      if (data.recipe && data.recipe !== 'DOM') trail.push(recipe?.label.replace(/ example$/, '') ?? data.recipe);
    }
  } else if (['subsystem', 'inport', 'outport'].includes(data.kind)) trail = ['Structure', template?.label ?? data.kind];
  else if (data.kind === 'renderer' || data.kind === 'scope') trail = ['Sinks', template?.label ?? data.kind];
  else if (data.kind === 'constant') trail = ['Sources', 'Constant'];
  else if (['gain', 'sum', 'integrator'].includes(data.kind)) trail = ['Operators & functions', template?.label ?? data.kind];
  else trail = ['JavaScript', data.operation?.type ?? template?.label ?? 'Module'];
  return { trail, symbol: recipe?.symbol ?? template?.symbol ?? 'JS', network: data.kind === 'subsystem' };
}
