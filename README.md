# Quadern de notes · Institut Candelera

Aplicació web perquè el professorat de l'Institut Candelera (l'Ametlla de Mar) posi i gestioni les notes. Substitueix els fulls de càlcul actuals.

- Graella de notes amb entrada ràpida pel teclat, qualificacions numèriques i qualitatives (AE, AN, AS, NA), NP i exempcions.
- Càlcul automàtic per situació d'aprenentatge, trimestre, curs i competència específica.
- Gràfics per alumne i per classe.
- Actitud, comentaris suggerits, exportació a Excel i resum per passar a Esfer@.
- Accés només per a usuaris donats d'alta. Cada professor veu només les seves notes.

## Instal·lació

Vegeu [GUIA-ADMIN.md](GUIA-ADMIN.md): creació del projecte de Supabase, base de dades, alta de professors i publicació a GitHub Pages.

## Estructura

```
index.html              pàgina de l'app
LogoCandelera.png       logo del centre
css/styles.css          estils (colors del logo, mode clar i fosc)
js/config.js            connexió amb Supabase (s'omple en instal·lar)
js/calc.js              càlcul de notes (funcions pures)
js/store.js             estructura de les dades
js/auth.js              sessió i desament a Supabase
js/seed.js              dades d'exemple fictícies
js/ui.js, charts.js     utilitats d'interfície i gràfics
js/app.js               menú, barra superior i navegació
js/pages/               una pantalla per fitxer
supabase/setup.sql      taules i regles de seguretat de la base de dades
```

No cal instal·lar ni compilar res: és HTML, CSS i JavaScript. Les biblioteques externes (Supabase, Chart.js i SheetJS) es carreguen des de CDN amb versions fixades.
