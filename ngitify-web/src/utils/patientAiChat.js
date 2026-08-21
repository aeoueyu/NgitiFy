export const PATIENT_AI_OPEN_EVENT = 'ngitify:patient-ai-open';

export const openPatientAiChat = () => {
    window.dispatchEvent(new CustomEvent(PATIENT_AI_OPEN_EVENT));
};
