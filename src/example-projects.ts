import attention from '../examples/attention-step-by-step.json?raw';
import transformer from '../examples/transformer-forward.json?raw';
import dictionary from '../examples/tokenization-dictionary.json?raw';
import nanogpt from '../examples/nanogpt-characters.json?raw';
import { parseDiagram } from './model';
export const exampleProjects = [
  { id:'attention' as const, json:attention, description:'Text → tokens → embeddings → attention → output projection.' },
  { id:'transformer' as const, json:transformer, description:'Tokenization, embeddings, attention and a feed-forward neural network.' },
  { id:'dictionary' as const, json:dictionary, description:'Split “dictionary” into subwords, vocabulary IDs and embedding rows.' },
  { id:'nanogpt' as const, json:nanogpt, description:'Explore parent blocks for character tokenization, causal attention, MLP and decoding. Untrained teaching model.' },
].map(({json,...example})=>({...example,project:parseDiagram(json)}));
