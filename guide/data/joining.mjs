// The joining chain (chapters joining, teams and your-data, in that order, on one load of the demonstration database):
// Nina, as the manifest gives her (chains.joining.invitee), with the password she chooses on camera. Her account exists
// only on a stack that has recorded the chain's first chapter.
export const NINA_PASSWORD = 'Wheat-guide-2026'

export const nina = (manifest) => ({ ...manifest.chains.joining.invitee, password: NINA_PASSWORD })
