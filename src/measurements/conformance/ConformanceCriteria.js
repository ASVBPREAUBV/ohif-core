import { CriteriaEvaluator } from './CriteriaEvaluator';
import * as initialEvaluations from './evaluations';
import loadStudy from '../../studies/loadStudy.js';

// TODO: this does not exist right now
const getStudyMetadata = () => {};

const evaluations = Object.assign({}, initialEvaluations);

const BASELINE = 'baseline';
const FOLLOWUP = 'followup';
const BOTH = 'both';
const TARGETS = 'targets';
const NONTARGETS = 'nonTargets';

class ConformanceCriteria {
  constructor(measurementApi, timepointApi) {
    this.measurementApi = measurementApi;
    this.timepointApi = timepointApi;
    this.nonconformities = []; //new ReactiveVar();
    this.groupedNonConformities = []; //new ReactiveVar();
    this.maxTargets = null; //new ReactiveVar(null);
    this.maxNewTargets = null; //new ReactiveVar(null);
  }

  validate(trialCriteriaType) {
    return new Promise((resolve, reject) => {
      const baselinePromise = this.getData(BASELINE);
      const followupPromise = this.getData(FOLLOWUP);
      Promise.all([baselinePromise, followupPromise]).then(values => {
        const [baselineData, followupData] = values;
        const mergedData = {
          targets: [],
          nonTargets: []
        };

        mergedData.targets = mergedData.targets.concat(baselineData.targets);
        mergedData.targets = mergedData.targets.concat(followupData.targets);
        mergedData.nonTargets = mergedData.nonTargets.concat(
          baselineData.nonTargets
        );
        mergedData.nonTargets = mergedData.nonTargets.concat(
          followupData.nonTargets
        );

        this.maxTargets.set(null);
        this.maxNewTargets.set(null);
        const resultBoth = this.validateTimepoint(
          BOTH,
          trialCriteriaType,
          mergedData
        );
        const resultBaseline = this.validateTimepoint(
          BASELINE,
          trialCriteriaType,
          baselineData
        );
        const resultFollowup = this.validateTimepoint(
          FOLLOWUP,
          trialCriteriaType,
          followupData
        );
        const nonconformities = resultBaseline
          .concat(resultFollowup)
          .concat(resultBoth);
        const groupedNonConformities = this.groupNonConformities(
          nonconformities
        );

        // Keep both? Group the data only on viewer/measurementTable views?
        // Work with not grouped data (worse lookup performance on measurementTableRow)?
        this.nonconformities.set(nonconformities);
        this.groupedNonConformities.set(groupedNonConformities);

        resolve(nonconformities);
      });
    });
  }

  groupNonConformities(nonconformities) {
    const groups = {};
    const toolsGroupsMap = this.measurementApi.toolsGroupsMap;

    nonconformities.forEach(nonConformity => {
      if (nonConformity.isGlobal) {
        groups.globals = groups.globals || { messages: [] };
        groups.globals.messages.push(nonConformity.message);

        return;
      }

      nonConformity.measurements.forEach(measurement => {
        const groupName = toolsGroupsMap[measurement.toolType];
        groups[groupName] = groups[groupName] || { measurementNumbers: {} };

        const group = groups[groupName];
        const measureNumber = measurement.measurementNumber;
        let measurementNumbers = group.measurementNumbers[measureNumber];

        if (!measurementNumbers) {
          measurementNumbers = group.measurementNumbers[measureNumber] = {
            messages: [],
            measurements: []
          };
        }

        measurementNumbers.messages.push(nonConformity.message);
        measurementNumbers.measurements.push(measurement);
      });
    });

    return groups;
  }

  validateTimepoint(timepointId, trialCriteriaType, data) {
    const evaluators = this.getEvaluators(timepointId, trialCriteriaType);
    let nonconformities = [];

    evaluators.forEach(evaluator => {
      const maxTargets = evaluator.getMaxTargets(false);
      const maxNewTargets = evaluator.getMaxTargets(true);
      if (maxTargets) {
        this.maxTargets.set(maxTargets);
      }

      if (maxNewTargets) {
        this.maxNewTargets.set(maxNewTargets);
      }

      const result = evaluator.evaluate(data);
      nonconformities = nonconformities.concat(result);
    });

    return nonconformities;
  }

  getEvaluators(timepointId, trialCriteriaType) {
    const evaluators = [];
    const trialCriteriaTypeId = trialCriteriaType.id.toLowerCase();
    const evaluation = evaluations[trialCriteriaTypeId];

    if (evaluation) {
      const evaluationTimepoint = evaluation[timepointId];

      if (evaluationTimepoint) {
        evaluators.push(new CriteriaEvaluator(evaluationTimepoint));
      }
    }

    return evaluators;
  }

  /*
   * Build the data that will be used to do the conformance criteria checks
   */
  getData(timepointType) {
    return new Promise((resolve, reject) => {
      const data = {
        targets: [],
        nonTargets: []
      };

      const studyPromises = [];

      const fillData = measurementType => {
        const measurements = this.measurementApi.fetch(measurementType);

        measurements.forEach(measurement => {
          const { studyInstanceUid } = measurement;

          const timepointId = measurement.timepointId;
          const timepoint =
            timepointId &&
            this.timepointApi.timepoints.find(
              a => a.timepointId === timepointId
            );

          if (
            !timepoint ||
            (timepointType !== BOTH &&
              timepoint.timepointType !== timepointType)
          ) {
            return;
          }

          const promise = loadStudy(studyInstanceUid);
          promise.then(study => {
            const studyMetadata = getStudyMetadata(study);

            data[measurementType].push({
              measurement,
              metadata: studyMetadata.getFirstInstance(),
              timepoint
            });
          });
          studyPromises.push(promise);
        });
      };

      fillData(TARGETS);
      fillData(NONTARGETS);

      Promise.all(studyPromises)
        .then(() => {
          resolve(data);
        })
        .catch(reject);
    });
  }

  static setEvaluationDefinitions(evaluationKey, evaluationDefinitions) {
    evaluations[evaluationKey] = evaluationDefinitions;
  }
}

export default ConformanceCriteria;
//OHIF.measurements.ConformanceCriteria = ConformanceCriteria;
