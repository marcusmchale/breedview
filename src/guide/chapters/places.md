# Sites, fields and layouts

Every unit observed is somewhere: a location, such as a field, within a farm, within a county and a country. Within a
location, a layout places units relative to one another, such as the plots of a trial in their blocks, rows and
columns. Next season's trial goes in a field the farm has not used before. This chapter adds the field, draws it on the
map, and lays out its trial.

> [!WHO]
> Those with Write access to a team, which controls what they add. Here, Theo Technician, of Field Operations.

## Before you start

The farm needs to exist: here, Example Research Farm, in County Offaly. A country is registered once, as the root of
its location tree, with Register a location tree; everything else is added inside it. A place the map's search finds,
such as a town or a farm, can be added as it is: its Add as a location fills in the new location's name, point and
address, and registers its country first if it isn't there yet.

![Sites, fields and layouts](places.mp4)

## Steps

1. **+ Add Child adds a place inside another.** On the farm, Theo adds Hill Field: a field, with its code and what it
   is like. Field Operations controls it, and it is public, as the farm's other fields are. {#field}
2. **The map takes its boundary.** With the polygon tool, a click at each corner, then at the first again, draws the
   field; Save as coordinates keeps it as the field's boundary. {#boundary}
3. **A layout tree places units within a location.** + New layout tree: Hill Field 2027 trial, a layout of the type
   Field trial blocks, whose one axis Theo names Block. It is private until the trial is shared. {#layout}
4. **Each block is a layout of its own.** + Add Child on the trial adds Block 1, at 1 on its Block axis: a plot grid,
   with the axes Row and Column. Blocks 2 and 3 are added the same way. {#block}
5. **Hill Field is ready to plant.** The trial holds its three blocks. Each plot is placed in a block by its row and
   column, in [Planting a trial](/guide/planting), and analyses can group records by any axis. {#ready}

## Who sees what

> [!SEES]
> A public location is seen by everyone, on the map too, as in [Looking around as a visitor](/guide/looking-around).
> A layout has a release of its own: a private one is seen by the teams with Read access to its control team.

> [!NOTE]
> The map's tiles come from BreedGraph's own server, and its place search is answered there, from its copy of
> GeoNames' places, so neither your browser nor the server sends what you search for to anyone else.

## Try it on the demo site

Sign in as Theo Technician (`theo`), add a field to the farm and draw it, or lay out a trial of your own.
