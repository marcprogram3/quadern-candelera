# Guia de l'administrador

Com posar en marxa el Quadern de notes, donar d'alta professors i publicar l'app.

---

## 1. Crear el projecte de Supabase (un sol cop)

1. Entreu a [supabase.com](https://supabase.com) i creeu un compte.
2. **New project**:
   - **Name:** `quadern-candelera` (o el que vulgueu).
   - **Database password:** genereu-ne una i guardeu-la en un lloc segur. L'app no la fa servir, però la necessitareu si mai heu d'accedir directament a la base de dades.
   - **Region:** **Central EU (Frankfurt)**. És important: les dades dels alumnes han de quedar dins la UE.
3. Espereu un parell de minuts que el projecte estigui a punt.

## 2. Preparar la base de dades

1. Al panell del projecte: **SQL Editor → New query**.
2. Copieu-hi tot el contingut de [`supabase/setup.sql`](supabase/setup.sql) i premeu **Run**.
3. Ha de dir *Success. No rows returned*. Es pot tornar a executar sense perill.

Això crea:
- **`profiles`:** nom d'usuari i nom complet de cada professor.
- **`notebooks`:** el quadern de cada professor, amb totes les seves matèries, alumnes i notes.
- **Les regles de seguretat:** cada professor només pot veure i modificar el seu quadern.

## 3. Tancar el registre

Perquè només entrin els usuaris que doneu d'alta vosaltres:

**Authentication → Sign In / Providers →** desactiveu **Allow new users to sign up** i deseu.

## 4. Connectar l'app amb Supabase

1. Al panell: **Project Settings → API Keys** (o el botó **Connect** de dalt).
2. Copieu:
   - **Project URL**, que s'assembla a `https://abcdefgh.supabase.co`.
   - La clau **anon / publishable**.
3. Obriu [`js/config.js`](js/config.js) i enganxeu-les:

```js
supabaseUrl: 'https://abcdefgh.supabase.co',
supabaseKey: 'eyJhbGciOi...',
```

> ⚠️ **Mai** no hi poseu la clau **service_role / secret**. Dona accés total a la base de dades i el codi serà públic a GitHub. La clau *anon / publishable* sí que pot ser pública: la protecció la donen les regles de seguretat del pas 2.

---

## 5. Donar d'alta un professor

Els professors entren amb un **nom d'usuari** (per exemple `mpuig`), no amb el correu. Internament, Supabase necessita un correu, així que es fa servir `usuari@candelera.local`, que no és cap adreça real.

1. **Authentication → Users → Add user → Create new user**.
2. **Email:** `mpuig@candelera.local` (l'usuari + `@candelera.local`).
3. **Password:** una contrasenya provisional, de mínim 8 caràcters.
4. Marqueu **Auto Confirm User**.
5. **Create user**.
6. Per posar-hi el nom complet: **Table Editor → profiles**, busqueu la fila de l'usuari i canvieu `full_name` per «Marta Puig». Si no ho feu, es mostrarà l'usuari.

Doneu al professor:
- **L'enllaç de l'app.**
- **L'usuari** (`mpuig`).
- **La contrasenya provisional.**

El primer cop que entri, l'app l'obligarà a triar una contrasenya pròpia que vosaltres no sabreu.

**Convenció de noms d'usuari:** inicial del nom + primer cognom, en minúscules i sense accents (`mpuig`, `jferrer`). Si es repeteix, afegiu-hi el segon cognom (`jferrerr`).

## 6. Restablir una contrasenya oblidada

No hi ha correus reals, així que no es pot recuperar per correu. Ho feu vosaltres:

1. **SQL Editor → New query**.
2. Canvieu l'usuari i la contrasenya provisional, i executeu:

```sql
update auth.users
set encrypted_password = extensions.crypt('Provisional2026', extensions.gen_salt('bf')),
    raw_user_meta_data = raw_user_meta_data - 'password_changed'
where email = 'mpuig@candelera.local';
```

3. Doneu la contrasenya provisional al professor. En entrar, l'app li tornarà a demanar que en triï una de nova.

Les notes **no es perden** en restablir la contrasenya.

## 7. Donar de baixa un professor

**Authentication → Users →** menú de la fila (⋯) **→ Delete user**.

> ⚠️ **S'esborra també el seu quadern amb totes les notes.** Abans, si cal conservar-les, demaneu-li que descarregui una còpia de seguretat (*Importar / Exportar → Descarrega la còpia*).

---

## 8. Publicar l'app a GitHub Pages

1. Creeu un repositori a [github.com](https://github.com), per exemple `quadern-candelera`.
2. Pugeu-hi tots els fitxers d'aquesta carpeta (`index.html`, `LogoCandelera.png`, `css/`, `js/`, `supabase/`…).
3. Al repositori: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
4. En un o dos minuts, l'app serà a `https://<el-vostre-usuari>.github.io/quadern-candelera/`.

Cada cop que pugeu canvis al repositori, l'app publicada s'actualitza sola.

---

## Coses a tenir en compte

- **Protecció de dades.** Són notes de menors. Abans de fer-hi servir dades reals, informeu-ne la direcció del centre i obteniu-ne el vistiplau. El projecte ha de ser a la regió de la UE (pas 1).
- **El pla gratuït de Supabase s'atura després d'una setmana sense ús**, per exemple durant les vacances. Les dades no es perden: entreu al panell i premeu **Restore project**. Si l'app es fa servir cada dia, no passa.
- **Còpies de seguretat.** El pla gratuït no inclou còpies automàtiques que pugueu descarregar. Recomaneu als professors descarregar una còpia de tant en tant. També podeu exportar la taula `notebooks` des de **Table Editor → notebooks → Export → CSV**.
- **La sessió es tanca sola** després de 20 minuts sense activitat i en tancar el navegador. Això és important en ordinadors compartits. El temps es pot canviar a `js/config.js` (`idleMinutes`).
