import {standardRecipes} from './standard-recipes';
// Compatibility export: recipes use the same run functions as the palette.
export const moduleRecipes={DOM:standardRecipes.DOM.logic,LaTeX:standardRecipes.LaTeX.logic,'Three.js':standardRecipes['Three.js'].logic};
