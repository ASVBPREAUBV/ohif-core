import { retrieveStudyMetadata } from './retrieveStudyMetadata';
import { StudyMetadata } from '../classes/metadata/StudyMetadata';
import { sortingManager } from '../utils/sortingManager.js';
import { updateMetaDataManager } from '../utils/updateMetaDataManager';
import studyMetadataManager from '../utils/studyMetadataManager';

// TODO: Use callbacks or redux?
const loadingDict = {};

/**
 * Load the study metadata and store its information locally
 *
 * @param {String} studyInstanceUid The UID of the Study to be loaded
 * @returns {Promise} that will be resolved with the study metadata or rejected with an error
 */
async function loadStudy(server, studyInstanceUid) {
  let currentLoadingState = loadingDict[studyInstanceUid];

  // Set the loading state as the study is not yet loaded
  if (currentLoadingState !== 'loading') {
    loadingDict[studyInstanceUid] = 'loading';
  }

  /*
  if (loadingDict[studyInstanceUid] === 'loaded') {
    ;
    resolve(studyLoaded);
    return;
  }*/

  const study = await retrieveStudyMetadata(server, studyInstanceUid);

  try {
    // Once the data was retrieved, the series are sorted by series and instance number
    OHIF.viewerbase.sortStudy(study);

    // Updates WADO-RS metaDataManager
    updateMetaDataManager(study);

    // Transform the study into a StudyMetadata object
    const studyMetadata = new StudyMetadata(study);

    // Add the display sets to the study
    study.displaySets = sortingManager.getDisplaySets(studyMetadata);

    studyMetadata.setDisplaySets(study.displaySets);

    // Persist study data into OHIF.viewer
    //OHIF.viewer.Studies.insert(study);
    //OHIF.viewer.StudyMetadataList.insert(study);

    // Add the study to the loading listener to allow loading progress handling
    //const studyLoadingListener = OHIF.viewerbase.StudyLoadingListener.getInstance();
    //studyLoadingListener.addStudy(study);

    // Add the studyInstanceUid to the loaded state dictionary
    loadingDict[studyInstanceUid] = 'loaded';

    studyMetadataManager.add(studyMetadata);

    return study;
  } catch (error) {
    loadingDict[studyInstanceUid] = 'failed';
    reject(error);
  }
}

export default loadStudy;
