export const targetCR = {
  id: 'targetCR',
  name: 'CR Target',
  toolGroup: 'allTools',
  cornerstoneToolType: 'targetCR',
  options: {
    measurementTable: {
      displayFunction: data => data.response
    },
    caseProgress: {
      include: true,
      evaluate: true
    }
  }
};
