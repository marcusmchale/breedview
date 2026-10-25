# Looking after the ontology

The ontology changes as a programme does: new terms are added, and terms no longer used are retired. Nothing that data
cites is ever deleted, so retiring a term never changes what the data means. This chapter grants an ontology role,
retires a factor, and brings it back.

> [!WHO]
> Ontology admins grant the roles. Editors, and admins, change and retire entries and commit versions. Here, Dara Data,
> the ontology's admin.

## Before you start

Anyone signed in can ask for an ontology role with Request Ontology Role, on the Ontology page. Adding entries is shown
in [Describing what you measure](/guide/describing).

![Looking after the ontology](looking-after-the-ontology.mp4)

## Steps

1. **Manage Roles lists the requests for a role.** Theo Technician, a contributor, has asked to be an editor; Dara
   sets his role. {#roles}
2. **Deprecate retires an entry from the next version.** Fungicide programme, a factor the trials no longer record, is
   deprecated from its form. The form offers to deprecate what defines it too, its condition, method and scale; Dara
   keeps those. {#deprecate}
3. **The next commit removes it.** A major version, as an entry is removed, with the ontology's licence and copyright.
   New data can no longer use the factor. {#commit}
4. **Data that cites it keeps it, marked retired.** The 2024 study recorded the factor: its datasets still list it,
   tagged retired, and its records keep their meaning, in curation and analysis alike. {#retired}
5. **A removed entry can be restored.** The retired tag offers to restore it, to editors: it comes back as a draft, with
   the same identity, so that old data and new cite the same entry once the next commit makes it current again.
   {#restore}

## Who sees what

> [!SEES]
> The roles, the drafts and the commit history are shown to those who are signed in. Each version, once committed, is
> public.

> [!DATA]
> A role request names the account that asked; the admins who grant roles see it on Manage Roles.

## Try it on the demo site

Sign in as Dara Data (`dara`) to grant roles, retire and restore entries, or as Theo Technician (`theo`) to ask for
a role.
