import 'dotenv/config';
import { z } from 'zod';
import { mastra } from './mastra';

const texto = `
Hola, soy Marta Ruiz, ingeniera de software en Acme Corp desde marzo de 2024.
Mi correo es marta.ruiz@acme.com y mi teléfono +34 600 123 456.
Estoy interesada en la posición de Staff Engineer que publicasteis.
`;

const schema = z.object({
  nombre: z.string().nullable().describe('Nombre completo de la persona'),
  empresa: z.string().nullable(),
  email: z.string().nullable(),
  telefono: z.string().nullable(),
  puesto_interes: z.string().nullable(),
  anio_inicio: z.number().nullable().describe('Año en que empezó en su empresa'),
});

const agent = mastra.getAgent('extractorAgent');
const res = await agent.generate(texto, { structuredOutput: { schema, jsonPromptInjection: 'auto' } });

console.log(JSON.stringify(res.object, null, 2));
