// Shared by the client auth provider and API wrapper. Never stores credentials.
let generation = 0

export const getAuthGeneration = () => generation
export const advanceAuthGeneration = () => ++generation
export const isCurrentAuthGeneration = (candidate) => candidate === generation
