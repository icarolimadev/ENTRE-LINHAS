// Entrada compartilhada por todas as telas.



import { iniciarNavegacao } from './navigation/navigation.js';
import { inicializarFormulario } from '../data/storage/localstorage.js';
import { inicializarHistoria } from './historias.js';



inicializarFormulario();
iniciarNavegacao();
inicializarHistoria();
