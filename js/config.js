/*
 * Configuració de connexió amb Supabase.
 *
 * Copieu-ho del panell de Supabase: Project Settings → API (o «Connect»).
 *   supabaseUrl: la «Project URL», p. ex. https://abcdefgh.supabase.co
 *   supabaseKey: la clau «anon» / «publishable». És pública i pot anar al codi:
 *                la seguretat la donen les regles RLS de la base de dades.
 *
 * MAI no poseu aquí la clau «service_role» / «secret»: dona accés a tot.
 */
const CONFIG = {
  supabaseUrl: 'https://bkqewdsrmghfotufcgve.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrcWV3ZHNybWdoZm90dWZjZ3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyNzEyOTksImV4cCI6MjEwODg0NzI5OX0.XXepq5oejxmm4swjkRzd1cCD_DKnheAfi_9lETZqGPE',

  // Els professors entren amb un nom d'usuari (p. ex. «mpuig»). Supabase
  // necessita un correu, així que internament es fa servir mpuig@candelera.local.
  // No és un correu real i no se n'envia cap.
  usernameDomain: 'candelera.local',

  // Minuts sense activitat abans de tancar la sessió automàticament.
  idleMinutes: 20,
};
