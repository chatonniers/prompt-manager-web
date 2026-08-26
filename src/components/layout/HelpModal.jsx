import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

/* ── Translations ──────────────────────────────────────────────────────── */
const TR = {
  en: {
    title: 'Help & Guide',
    subtitle: 'Everything you need to run better demos',
    tabs: {
      basics:   'Basics',
      prompts:  'Prompts',
      library:  'Library',
      workflow: 'Workflow',
      admin:    'Admin & Settings',
    },
    basics: {
      whatTitle: 'What is PromptDeck?',
      whatBody: 'A shared library of demo prompts for SAP tools — Joule, IBP, S/4HANA, Ariba and more. Find the right prompt fast, copy it in one click, and run your demo.',
      areasTitle: 'The main areas',
      sidebarTitle: 'Left sidebar — navigation',
      sidebarBody: 'Filter by Category, Story Flow, Solution, or AI Assistant. Click any item to scope the view. The active filter is highlighted.',
      gridTitle: 'Card grid — your prompts',
      gridBody: 'Each card shows the prompt title, numbered steps, category/flow/solution pills, and status. Click a step row to copy it instantly.',
      topbarTitle: 'Top bar — search & actions',
      topbarBody: 'Search ranks results by relevance (title first, then body). New Prompt, workspace toggle, bell notifications, and settings are all here.',
      workspacesTitle: 'Workspaces',
      libraryTitle: 'Library',
      libraryBody: 'All published prompts shared with the team. This is the default view.',
      mineTitle: 'My Prompts',
      mineBody: 'Your personal drafts — private by default, invisible to others until published. Background tint changes to green when in My Prompts.',
      workspaceTip: 'Switching workspace shows a confirmation popover. You can turn this off in your profile panel (user pill → Preferences → Space warning).',
      shortcutsTitle: 'Quick shortcuts',
      sc1: 'Copy that prompt to clipboard',
      sc2: 'Close any open modal or search',
      sc3: 'Move to a different category, flow, or pin as favorite',
      sc4: 'Toggle language for copy — cards with FR translation switch automatically',
    },
    prompts: {
      createTitle: 'Creating a prompt',
      newTitle: 'Click "+ New" in the top bar',
      newBody: 'Fill in a title, then add one or more prompt steps (label + body text). Use the Details tab to set category, story flow, AI assistant, industry, solutions, status, and attachments.',
      multiTitle: 'Multi-step prompts',
      multiBody: 'Add multiple steps with the + tab in the Content view. Each step gets its own label (e.g. "Step 1 — Analyze") and body. On the card they appear as numbered rows — click any row to copy that step alone.',
      bilingualTitle: 'Bilingual (EN / FR)',
      bilingualBody: 'Each step body has an EN and FR field. When FR is filled in and the language is set to FR, copying a step uses the FR text. The card shows a pill indicator when FR is available.',
      copyTitle: 'Copying prompts',
      oneClickTitle: 'One-click copy',
      oneClickBody: 'Click any step row on the card front. The row flashes a checkmark on success and your clipboard is ready to paste into Joule or any SAP tool.',
      placeholderTitle: 'Placeholders',
      placeholderBody: 'If a prompt body contains [PLACEHOLDERS], a fill-in modal opens before copying so you can substitute values without editing the prompt.',
      copyTip: 'Switch to FR in your profile panel before copying to get the French version automatically if it\'s been filled in.',
      organizeTitle: 'Editing & organizing',
      editTitle: 'Edit a prompt',
      editBody: 'Click the pencil icon on any card (or the card title area) to open the edit modal. All fields are available: content, details, attachments, visibility, and status.',
      dupeTitle: 'Duplicate a prompt',
      dupeBody: 'Use the duplicate icon on a card to copy it — choose whether to place the copy in Library or in My Prompts. The duplicate opens immediately for editing.',
      favTitle: 'Favorites',
      favBody: 'Drag a card to the Favorites strip at the top of the grid to pin it. Favorites always appear first regardless of filters.',
      dndTitle: 'Drag & drop',
      dndBody: 'Drag any card onto a category tab to reassign its category, into a flow column to change its story flow, or up to the Favorites strip to pin it. An Undo bar appears for 5 seconds after each move.',
      bulkTitle: 'Bulk actions',
      bulkBody: 'Hover a card to reveal its checkbox. Select multiple cards — a bulk action bar appears with Export, Move category, Move flow, Move assistant, Move industry, and Delete.',
    },
    library: {
      findTitle: 'Finding prompts',
      searchTitle: 'Search',
      searchBody: 'The search bar ranks all prompts by relevance — title matches score highest, followed by body and solutions. Press Escape to clear.',
      filterTitle: 'Sidebar filters',
      filterBody: 'Click a Category, Story Flow, Solution, or AI Assistant in the left sidebar to filter. The grid shows only matching prompts. Click again to clear.',
      tabsTitle: 'Category tabs',
      tabsBody: 'In the All Prompts view, categories appear as tabs above the grid. Cards can be grouped by story flow or by AI assistant — use the grouping toggle above the grid to switch.',
      viewTitle: 'Viewing modes',
      cardsTableTitle: 'Cards vs Table',
      cardsTableBody: 'Toggle between card grid and table view from your profile panel (user pill → View). Table view is denser — useful for quick scanning of many prompts.',
      zoomTitle: 'Zoom',
      zoomBody: 'Adjust card scale (50%–200%) from your profile panel (user pill → Zoom). The zoom level is saved automatically.',
      themeTitle: 'Dark / Light theme',
      themeBody: 'Switch themes from your profile panel (user pill → Theme). Your preference is saved across sessions.',
      langTitle: 'Language',
      langBody: 'Switch between EN and FR from your profile panel (user pill → Language). The selected language persists after a page refresh.',
      statusTitle: 'Status badges',
      draftDesc: 'Work in progress, visible only to you (or editors/admins if Public)',
      publishedDesc: 'Visible to everyone in the Library workspace',
      archivedDesc: 'Retired prompt, hidden from normal views',
    },
    workflow: {
      privacyTitle: 'Privacy & publish',
      privateTitle: 'All drafts start Private',
      privateBody: 'New prompts are private by default — only you can see them. Flip the visibility toggle on the card to make it Public (visible to editors and admins as a shared draft).',
      requestTitle: 'Viewers: request to publish',
      requestBody: 'Once your draft is Public, use the "↑ Request publish" button on the card. Editors and admins receive a bell notification and can review your prompt.',
      approveTitle: 'Editors & Admins: approve or reject',
      approveBody: 'Open the bell (top-right) to see pending publish requests with a prompt preview. Approve moves the card to the shared Library. Reject returns it to the author.',
      workflowTip: 'If your request is approved and you later edit the prompt, it resets to Private draft. You can request publish again when ready.',
      bellTitle: 'Bell notifications',
      badgeTitle: 'What the badge means',
      badgeBody: 'Editors / Admins: number of pending publish requests + unseen new user signups. Viewers: number of your requests that have been resolved (approved or rejected) since you last checked.',
      realtimeTitle: 'Real-time updates',
      realtimeBody: 'The badge and panel update live via Supabase Realtime — no page refresh needed. Notifications arrive within seconds of the event.',
      rolesTitle: 'Roles',
      viewerDesc: 'Browse Library, copy prompts, create private drafts, request publish',
      editorDesc: 'Everything Viewer can do, plus publish directly, approve/reject requests, manage catalog',
      adminDesc: 'Everything Editor can do, plus user management, visibility rules, statistics, system actions',
    },
    admin: {
      settingsTitle: 'Settings (gear icon, top bar)',
      usersTitle: 'Users',
      usersBody: 'Manage all user accounts — set roles (Viewer, Editor, Admin), block users, kick active sessions. New signups appear as a badge on the bell icon.',
      statsTitle: 'Statistics',
      statsBody: 'Usage analytics — most copied prompts, active users, sessions over time.',
      visibilityTitle: 'Visibility Rules',
      visibilityBody: 'Control which prompts are visible to which roles. Fine-grained access beyond the basic Private / Public toggle.',
      systemTitle: 'System — Notify users to refresh',
      systemBody: 'After deploying updates, use Settings → Admin → System → "Notify all users to refresh" to broadcast a banner to every connected user prompting them to hard-refresh.',
      catalogTitle: 'Catalog management',
      catalogItemsTitle: 'Categories, Flows, Solutions, AI Assistants, Industries, Tags, Personas, Systems',
      catalogItemsBody: 'All shared catalog items are managed here. Changes apply immediately for all users. Drag rows to reorder. AI Assistants and Industries are new catalog types that can be assigned to prompts and used for filtering. Systems support MCP endpoint credentials (secrets hidden by default).',
      catalogTip: 'Renaming a category or flow updates all prompts that reference it automatically.',
      importExportTitle: 'Import / Export',
      exportTitle: 'Export',
      exportBody: 'Downloads the full prompt library as a JSON file — useful for backup or migration.',
      importTitle: 'Import',
      importBody: 'Upload a JSON export file. Choose Merge (add new, skip duplicates) or Replace (overwrite everything). A confirmation modal shows the counts before committing.',
      mcpTitle: 'MCP — AI assistant integration',
      mcpConnectTitle: 'Connect Joule / Claude / any MCP client',
      mcpConnectBody: 'PromptDeck exposes an MCP server. Copy the endpoint URL from your profile panel (user pill → PromptDeck MCP) and add it to your AI assistant\'s MCP config. The assistant can then search and retrieve prompts directly.',
      mcpSkillTitle: 'Joule skill files',
      mcpSkillBody: 'Prompts with a Joule skill attachment get the .skill file uploaded to Supabase Storage on save. The MCP server returns a public download URL so Joule Desktop can install the skill automatically.',
    },
  },
  fr: {
    title: 'Aide & Guide',
    subtitle: 'Tout ce qu\'il faut pour réussir vos démos',
    tabs: {
      basics:   'Bases',
      prompts:  'Prompts',
      library:  'Bibliothèque',
      workflow: 'Workflow',
      admin:    'Admin & Paramètres',
    },
    basics: {
      whatTitle: 'Qu\'est-ce que PromptDeck ?',
      whatBody: 'Une bibliothèque partagée de prompts pour les outils SAP — Joule, IBP, S/4HANA, Ariba et plus. Trouvez le bon prompt rapidement, copiez-le en un clic et démarrez votre démo.',
      areasTitle: 'Les zones principales',
      sidebarTitle: 'Barre latérale — navigation',
      sidebarBody: 'Filtrez par Catégorie, Story Flow, Solution ou Assistant IA. Cliquez sur un élément pour affiner la vue. Le filtre actif est mis en évidence.',
      gridTitle: 'Grille de cartes — vos prompts',
      gridBody: 'Chaque carte affiche le titre du prompt, les étapes numérotées, les badges catégorie/flow/solution et le statut. Cliquez sur une ligne d\'étape pour la copier instantanément.',
      topbarTitle: 'Barre supérieure — recherche & actions',
      topbarBody: 'La recherche classe les résultats par pertinence (titre en premier, puis corps). Nouveau Prompt, bascule workspace, notifications et paramètres s\'y trouvent.',
      workspacesTitle: 'Espaces de travail',
      libraryTitle: 'Bibliothèque',
      libraryBody: 'Tous les prompts publiés partagés avec l\'équipe. C\'est la vue par défaut.',
      mineTitle: 'Mes Prompts',
      mineBody: 'Vos brouillons personnels — privés par défaut, invisibles aux autres jusqu\'à publication. L\'arrière-plan devient vert dans l\'espace Mes Prompts.',
      workspaceTip: 'Changer d\'espace affiche une fenêtre de confirmation. Vous pouvez la désactiver dans votre panneau de profil (pastille utilisateur → Préférences → Avertissement espace).',
      shortcutsTitle: 'Raccourcis rapides',
      sc1: 'Copier ce prompt dans le presse-papiers',
      sc2: 'Fermer toute fenêtre modale ou la recherche',
      sc3: 'Déplacer vers une autre catégorie, flow ou épingler en favori',
      sc4: 'Basculer la langue de copie — les cartes avec traduction FR basculent automatiquement',
    },
    prompts: {
      createTitle: 'Créer un prompt',
      newTitle: 'Cliquez sur "+ Nouveau" dans la barre supérieure',
      newBody: 'Remplissez un titre, puis ajoutez une ou plusieurs étapes (libellé + texte). Utilisez l\'onglet Détails pour la catégorie, le flow, l\'assistant IA, l\'industrie, les solutions, le statut et les pièces jointes.',
      multiTitle: 'Prompts multi-étapes',
      multiBody: 'Ajoutez plusieurs étapes avec le bouton + dans la vue Contenu. Chaque étape a son propre libellé (ex. "Étape 1 — Analyser") et son corps. Sur la carte, elles apparaissent en lignes numérotées — cliquez sur une ligne pour copier cette étape seule.',
      bilingualTitle: 'Bilingue (EN / FR)',
      bilingualBody: 'Chaque étape a un champ EN et FR. Quand le FR est rempli et que la langue est FR, la copie utilise le texte FR. La carte affiche un badge indicateur quand le FR est disponible.',
      copyTitle: 'Copier des prompts',
      oneClickTitle: 'Copie en un clic',
      oneClickBody: 'Cliquez sur n\'importe quelle ligne d\'étape sur la face avant de la carte. La ligne clignote avec une coche et le presse-papiers est prêt à coller dans Joule ou tout outil SAP.',
      placeholderTitle: 'Espaces réservés',
      placeholderBody: 'Si le corps d\'un prompt contient des [ESPACES_RÉSERVÉS], une fenêtre de saisie s\'ouvre avant la copie pour substituer les valeurs sans modifier le prompt.',
      copyTip: 'Passez en FR dans votre panneau de profil avant de copier pour obtenir automatiquement la version française si elle a été remplie.',
      organizeTitle: 'Modifier & organiser',
      editTitle: 'Modifier un prompt',
      editBody: 'Cliquez sur l\'icône crayon d\'une carte (ou sur le titre) pour ouvrir la fenêtre de modification. Tous les champs sont disponibles : contenu, détails, pièces jointes, visibilité et statut.',
      dupeTitle: 'Dupliquer un prompt',
      dupeBody: 'Utilisez l\'icône de duplication sur une carte pour la copier — choisissez si la copie doit aller dans la Bibliothèque ou dans Mes Prompts. Le doublon s\'ouvre immédiatement pour modification.',
      favTitle: 'Favoris',
      favBody: 'Faites glisser une carte vers la bande Favoris en haut de la grille pour l\'épingler. Les favoris apparaissent toujours en premier, indépendamment des filtres.',
      dndTitle: 'Glisser-déposer',
      dndBody: 'Faites glisser une carte sur un onglet de catégorie pour la réassigner, dans une colonne de flow pour changer son story flow, ou vers la bande Favoris pour l\'épingler. Une barre d\'annulation apparaît pendant 5 secondes après chaque déplacement.',
      bulkTitle: 'Actions groupées',
      bulkBody: 'Survolez une carte pour révéler sa case à cocher. Sélectionnez plusieurs cartes — une barre d\'actions apparaît avec Exporter, Déplacer catégorie, Déplacer flow, Déplacer assistant, Déplacer industrie et Supprimer.',
    },
    library: {
      findTitle: 'Trouver des prompts',
      searchTitle: 'Recherche',
      searchBody: 'La barre de recherche classe tous les prompts par pertinence — les correspondances de titre sont prioritaires, suivies du corps et des solutions. Appuyez sur Échap pour effacer.',
      filterTitle: 'Filtres de la barre latérale',
      filterBody: 'Cliquez sur une Catégorie, un Story Flow, une Solution ou un Assistant IA dans la barre latérale pour filtrer. La grille n\'affiche que les prompts correspondants. Cliquez à nouveau pour effacer.',
      tabsTitle: 'Onglets de catégories',
      tabsBody: 'Dans la vue Tous les Prompts, les catégories apparaissent comme des onglets au-dessus de la grille. Les cartes peuvent être regroupées par story flow ou par assistant IA — utilisez le bouton de regroupement au-dessus de la grille pour basculer.',
      viewTitle: 'Modes d\'affichage',
      cardsTableTitle: 'Cartes vs Tableau',
      cardsTableBody: 'Basculez entre grille de cartes et vue tableau depuis votre panneau de profil (pastille utilisateur → Vue). Le tableau est plus dense — utile pour parcourir rapidement de nombreux prompts.',
      zoomTitle: 'Zoom',
      zoomBody: 'Ajustez l\'échelle des cartes (50%–200%) depuis votre panneau de profil (pastille utilisateur → Zoom). Le niveau de zoom est sauvegardé automatiquement.',
      themeTitle: 'Thème sombre / clair',
      themeBody: 'Changez de thème depuis votre panneau de profil (pastille utilisateur → Thème). Votre préférence est sauvegardée entre les sessions.',
      langTitle: 'Langue',
      langBody: 'Basculez entre EN et FR depuis votre panneau de profil (pastille utilisateur → Langue). La langue sélectionnée persiste après un rechargement de page.',
      statusTitle: 'Badges de statut',
      draftDesc: 'Travail en cours, visible uniquement par vous (ou éditeurs/admins si Public)',
      publishedDesc: 'Visible par tous dans l\'espace Bibliothèque',
      archivedDesc: 'Prompt retiré, masqué des vues normales',
    },
    workflow: {
      privacyTitle: 'Confidentialité & publication',
      privateTitle: 'Tous les brouillons démarrent en Privé',
      privateBody: 'Les nouveaux prompts sont privés par défaut — seul vous pouvez les voir. Activez le bouton de visibilité sur la carte pour le rendre Public (visible aux éditeurs et admins comme brouillon partagé).',
      requestTitle: 'Viewers : demander la publication',
      requestBody: 'Une fois votre brouillon Public, utilisez le bouton "↑ Demander la publication" sur la carte. Les éditeurs et admins reçoivent une notification et peuvent examiner votre prompt.',
      approveTitle: 'Éditeurs & Admins : approuver ou rejeter',
      approveBody: 'Ouvrez la cloche (en haut à droite) pour voir les demandes de publication en attente avec un aperçu du prompt. Approuver déplace la carte dans la Bibliothèque partagée. Rejeter la renvoie à l\'auteur.',
      workflowTip: 'Si votre demande est approuvée et que vous modifiez ensuite le prompt, il repasse en brouillon Privé. Vous pouvez redemander la publication quand vous êtes prêt.',
      bellTitle: 'Notifications cloche',
      badgeTitle: 'Signification du badge',
      badgeBody: 'Éditeurs / Admins : nombre de demandes de publication en attente + nouveaux utilisateurs non vus. Viewers : nombre de vos demandes résolues (approuvées ou rejetées) depuis votre dernière consultation.',
      realtimeTitle: 'Mises à jour en temps réel',
      realtimeBody: 'Le badge et le panneau se mettent à jour en direct via Supabase Realtime — aucun rechargement de page nécessaire. Les notifications arrivent en quelques secondes.',
      rolesTitle: 'Rôles',
      viewerDesc: 'Consulter la Bibliothèque, copier des prompts, créer des brouillons privés, demander la publication',
      editorDesc: 'Tout ce que Viewer peut faire, plus publier directement, approuver/rejeter les demandes, gérer le catalogue',
      adminDesc: 'Tout ce qu\'Éditeur peut faire, plus gestion des utilisateurs, règles de visibilité, statistiques, actions système',
    },
    admin: {
      settingsTitle: 'Paramètres (icône curseurs, barre supérieure)',
      usersTitle: 'Utilisateurs',
      usersBody: 'Gérer tous les comptes — définir les rôles (Viewer, Éditeur, Admin), bloquer des utilisateurs, déconnecter des sessions actives. Les nouvelles inscriptions apparaissent comme badge sur la cloche.',
      statsTitle: 'Statistiques',
      statsBody: 'Analyses d\'utilisation — prompts les plus copiés, utilisateurs actifs, sessions au fil du temps.',
      visibilityTitle: 'Règles de visibilité',
      visibilityBody: 'Contrôlez quels prompts sont visibles pour quels rôles. Accès granulaire au-delà du simple bouton Privé / Public.',
      systemTitle: 'Système — Notifier les utilisateurs de rafraîchir',
      systemBody: 'Après le déploiement de mises à jour, utilisez Paramètres → Admin → Système → "Notifier tous les utilisateurs de rafraîchir" pour diffuser une bannière à tous les utilisateurs connectés.',
      catalogTitle: 'Gestion du catalogue',
      catalogItemsTitle: 'Catégories, Flows, Solutions, Assistants IA, Industries, Tags, Personas, Systèmes',
      catalogItemsBody: 'Tous les éléments du catalogue partagé sont gérés ici. Les modifications s\'appliquent immédiatement pour tous les utilisateurs. Faites glisser les lignes pour les réordonner. Les Assistants IA et Industries sont de nouveaux types de catalogue assignables aux prompts et utilisables pour le filtrage. Les systèmes supportent les identifiants MCP (secrets masqués par défaut).',
      catalogTip: 'Renommer une catégorie ou un flow met à jour automatiquement tous les prompts qui y font référence.',
      importExportTitle: 'Import / Export',
      exportTitle: 'Export',
      exportBody: 'Télécharge la bibliothèque complète de prompts en fichier JSON — utile pour la sauvegarde ou la migration.',
      importTitle: 'Import',
      importBody: 'Importez un fichier JSON exporté. Choisissez Fusionner (ajouter les nouveaux, ignorer les doublons) ou Remplacer (tout écraser). Une fenêtre de confirmation affiche les comptes avant validation.',
      mcpTitle: 'MCP — Intégration assistant IA',
      mcpConnectTitle: 'Connecter Joule / Claude / tout client MCP',
      mcpConnectBody: 'PromptDeck expose un serveur MCP. Copiez l\'URL du point de terminaison depuis votre panneau de profil (pastille utilisateur → PromptDeck MCP) et ajoutez-la à la config MCP de votre assistant IA. L\'assistant peut alors rechercher et récupérer des prompts directement.',
      mcpSkillTitle: 'Fichiers de compétences Joule',
      mcpSkillBody: 'Les prompts avec une pièce jointe de compétence Joule voient le fichier .skill envoyé dans Supabase Storage lors de l\'enregistrement. Le serveur MCP retourne une URL de téléchargement public pour que Joule Desktop installe la compétence automatiquement.',
    },
  },
};

/* ── Sub-components ─────────────────────────────────────────────────────── */

function Feature({ icon, title, children }) {
  return (
    <div className="hg-feature">
      <div className="hg-feature-icon">{icon}</div>
      <div>
        <div className="hg-feature-title">{title}</div>
        <div className="hg-feature-body">{children}</div>
      </div>
    </div>
  );
}

function Tip({ children }) {
  return <div className="hg-tip">💡 {children}</div>;
}

function Section({ title, children }) {
  return (
    <div className="hg-section">
      <div className="hg-section-title">{title}</div>
      {children}
    </div>
  );
}

/* ── Tab content ────────────────────────────────────────────────────────── */

function TabBasics({ tr }) {
  const t = tr.basics;
  return (
    <>
      <Section title={t.whatTitle}>
        <p className="hg-intro">{t.whatBody}</p>
      </Section>
      <Section title={t.areasTitle}>
        <Feature icon="🗂️" title={t.sidebarTitle}>{t.sidebarBody}</Feature>
        <Feature icon="🃏" title={t.gridTitle}>{t.gridBody}</Feature>
        <Feature icon="🔍" title={t.topbarTitle}>{t.topbarBody}</Feature>
      </Section>
      <Section title={t.workspacesTitle}>
        <Feature icon="📚" title={t.libraryTitle}>{t.libraryBody}</Feature>
        <Feature icon="👤" title={t.mineTitle}>{t.mineBody}</Feature>
        <Tip>{t.workspaceTip}</Tip>
      </Section>
      <Section title={t.shortcutsTitle}>
        <div className="hg-shortcuts">
          <div className="hg-shortcut-row"><kbd>Click / Clic</kbd><span>{t.sc1}</span></div>
          <div className="hg-shortcut-row"><kbd>Esc</kbd><span>{t.sc2}</span></div>
          <div className="hg-shortcut-row"><kbd>Drag / Glisser</kbd><span>{t.sc3}</span></div>
          <div className="hg-shortcut-row"><kbd>EN / FR</kbd><span>{t.sc4}</span></div>
        </div>
      </Section>
    </>
  );
}

function TabPrompts({ tr }) {
  const t = tr.prompts;
  return (
    <>
      <Section title={t.createTitle}>
        <Feature icon="➕" title={t.newTitle}>{t.newBody}</Feature>
        <Feature icon="🔢" title={t.multiTitle}>{t.multiBody}</Feature>
        <Feature icon="🌐" title={t.bilingualTitle}>{t.bilingualBody}</Feature>
      </Section>
      <Section title={t.copyTitle}>
        <Feature icon="📋" title={t.oneClickTitle}>{t.oneClickBody}</Feature>
        <Feature icon="🔲" title={t.placeholderTitle}>{t.placeholderBody}</Feature>
        <Tip>{t.copyTip}</Tip>
      </Section>
      <Section title={t.organizeTitle}>
        <Feature icon="✏️" title={t.editTitle}>{t.editBody}</Feature>
        <Feature icon="📄" title={t.dupeTitle}>{t.dupeBody}</Feature>
        <Feature icon="⭐" title={t.favTitle}>{t.favBody}</Feature>
        <Feature icon="↕️" title={t.dndTitle}>{t.dndBody}</Feature>
        <Feature icon="☑️" title={t.bulkTitle}>{t.bulkBody}</Feature>
      </Section>
    </>
  );
}

function TabLibrary({ tr }) {
  const t = tr.library;
  return (
    <>
      <Section title={t.findTitle}>
        <Feature icon="🔍" title={t.searchTitle}>{t.searchBody}</Feature>
        <Feature icon="🗂️" title={t.filterTitle}>{t.filterBody}</Feature>
        <Feature icon="📑" title={t.tabsTitle}>{t.tabsBody}</Feature>
      </Section>
      <Section title={t.viewTitle}>
        <Feature icon="🃏" title={t.cardsTableTitle}>{t.cardsTableBody}</Feature>
        <Feature icon="🔎" title={t.zoomTitle}>{t.zoomBody}</Feature>
        <Feature icon="🌗" title={t.themeTitle}>{t.themeBody}</Feature>
        <Feature icon="🌐" title={t.langTitle}>{t.langBody}</Feature>
      </Section>
      <Section title={t.statusTitle}>
        <div className="hg-status-grid">
          <div className="hg-status-item"><span className="hg-badge hg-badge-draft">Draft</span><span>{t.draftDesc}</span></div>
          <div className="hg-status-item"><span className="hg-badge hg-badge-published">Published</span><span>{t.publishedDesc}</span></div>
          <div className="hg-status-item"><span className="hg-badge hg-badge-archived">Archived</span><span>{t.archivedDesc}</span></div>
        </div>
      </Section>
    </>
  );
}

function TabWorkflow({ tr }) {
  const t = tr.workflow;
  return (
    <>
      <Section title={t.privacyTitle}>
        <Feature icon="🔒" title={t.privateTitle}>{t.privateBody}</Feature>
        <Feature icon="📤" title={t.requestTitle}>{t.requestBody}</Feature>
        <Feature icon="✅" title={t.approveTitle}>{t.approveBody}</Feature>
        <Tip>{t.workflowTip}</Tip>
      </Section>
      <Section title={t.bellTitle}>
        <Feature icon="🔔" title={t.badgeTitle}>{t.badgeBody}</Feature>
        <Feature icon="⚡" title={t.realtimeTitle}>{t.realtimeBody}</Feature>
      </Section>
      <Section title={t.rolesTitle}>
        <div className="hg-roles">
          <div className="hg-role-row"><span className="hg-role-badge hg-role-viewer">Viewer</span><span>{t.viewerDesc}</span></div>
          <div className="hg-role-row"><span className="hg-role-badge hg-role-editor">Editor</span><span>{t.editorDesc}</span></div>
          <div className="hg-role-row"><span className="hg-role-badge hg-role-admin">Admin</span><span>{t.adminDesc}</span></div>
        </div>
      </Section>
    </>
  );
}

function TabAdmin({ tr }) {
  const t = tr.admin;
  return (
    <>
      <Section title={t.settingsTitle}>
        <Feature icon="👥" title={t.usersTitle}>{t.usersBody}</Feature>
        <Feature icon="📊" title={t.statsTitle}>{t.statsBody}</Feature>
        <Feature icon="👁️" title={t.visibilityTitle}>{t.visibilityBody}</Feature>
        <Feature icon="🔔" title={t.systemTitle}>{t.systemBody}</Feature>
      </Section>
      <Section title={t.catalogTitle}>
        <Feature icon="🗂️" title={t.catalogItemsTitle}>{t.catalogItemsBody}</Feature>
        <Tip>{t.catalogTip}</Tip>
      </Section>
      <Section title={t.importExportTitle}>
        <Feature icon="📤" title={t.exportTitle}>{t.exportBody}</Feature>
        <Feature icon="📥" title={t.importTitle}>{t.importBody}</Feature>
      </Section>
      <Section title={t.mcpTitle}>
        <Feature icon="🤖" title={t.mcpConnectTitle}>{t.mcpConnectBody}</Feature>
        <Feature icon="⚡" title={t.mcpSkillTitle}>{t.mcpSkillBody}</Feature>
      </Section>
    </>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function HelpModal({ onClose }) {
  const { state } = useApp();
  const { isAdmin, isEditor } = useAuth();
  const lang = state.settings?.lang === 'fr' ? 'fr' : 'en';
  const tr = TR[lang];
  const [activeTab, setActiveTab] = useState('basics');

  const TABS = [
    { id: 'basics',   label: tr.tabs.basics,   icon: '🏠' },
    { id: 'prompts',  label: tr.tabs.prompts,  icon: '📋' },
    { id: 'library',  label: tr.tabs.library,  icon: '📚' },
    { id: 'workflow', label: tr.tabs.workflow,  icon: '🔄' },
    { id: 'admin',    label: tr.tabs.admin,     icon: '⚙️' },
  ];

  const visibleTabs = isAdmin || isEditor ? TABS : TABS.filter(t => t.id !== 'admin');

  const TAB_CONTENT = {
    basics:   <TabBasics tr={tr} />,
    prompts:  <TabPrompts tr={tr} />,
    library:  <TabLibrary tr={tr} />,
    workflow: <TabWorkflow tr={tr} />,
    admin:    <TabAdmin tr={tr} />,
  };

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="help-backdrop" onClick={e => { if (e.target.classList.contains('help-backdrop')) onClose(); }}>
      <div className="help-modal">

        <div className="help-header">
          <div className="help-header-left">
            <span className="help-header-icon">?</span>
            <div>
              <div className="help-title">{tr.title}</div>
              <div className="help-subtitle">{tr.subtitle}</div>
            </div>
          </div>
          <button className="help-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="hg-tabs">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              className={`hg-tab${activeTab === tab.id ? ' hg-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="hg-tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="help-body">
          {TAB_CONTENT[activeTab]}
        </div>

      </div>
    </div>
  );
}
