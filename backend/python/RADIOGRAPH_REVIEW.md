# Radiograph Review model note

## Computer-vision baseline

`radiograph_analyze.py` is an isolated OpenCV review service invoked by the Node backend. Version: `opencv-tooth-region-baseline-v1.0.0`.

It measures grayscale mean brightness, standard deviation (contrast), Laplacian variance (sharpness), and dark/bright clipping ratios. The API converts those measurements into `Good`, `Fair`, or `Needs Review` and returns the specific measurement-based reasons. Current review thresholds are:

- brightness below 48 or above 207;
- contrast standard deviation below 28;
- Laplacian variance below 35;
- dark or bright clipping above 18%.

These are transparent engineering thresholds for visibility triage, not medical confidence or retake criteria. They require calibration against the acquisition devices used by the clinic.

The tooth-region stage uses CLAHE, Otsu thresholding, morphology, and contour filtering. For panoramic-style layouts it orders candidate regions by arch and image position to produce tentative permanent-dentition FDI numbers. It is an unvalidated experimental baseline, not a trained or clinically validated detector. It must not be used for disease detection, autonomous diagnosis, primary-tooth numbering, mixed dentition, or treatment decisions. Every suggestion is stored as `pending` until a dentist confirms, corrects, or ignores it.

No patient identity is sent to the Python process. The process receives only the stored image data URL and returns normalized geometry, suggestion confidence, objective image measurements, model version, prediction type, and limitations.

## Adaptive image enhancement

`radiograph_enhance.py` preserves the stored original and creates a separate PNG derivative. The default `ngitify-adaptive-radiograph-v1.0.0` pipeline selects conservative denoising, local-contrast, and detail-refinement strengths from objective source measurements and the controlled radiograph type. Periapical, bitewing, occlusal, panoramic, and fallback profiles are intentionally separate.

The enhancer returns its version, selected profile, source bit depth and dimensions, before/after engineering measurements, transformations, and limitations. Extremely low-resolution or extensively clipped inputs are rejected because missing information cannot be safely reconstructed. Substantially blurred inputs receive limited sharpening and a warning.

Generic Real-ESRGAN remains an experimental super-resolution option. It is not the default and its output must be compared with the immutable original because generative restoration may introduce artificial detail. Dentist usefulness and artifact feedback is stored with the enhancement variant for internal improvement; it is not a diagnostic label.

## Internal confidence bands

The application uses documented review bands:

- high: 0.85 or greater;
- medium: 0.60 through 0.8499;
- low: below 0.60.

The contour baseline intentionally caps its own confidence below 0.85 because it has not been clinically validated. Tooth-region suggestions and detection geometry are not displayed in the radiograph review interface. Confidence is never called accuracy.

## Language layer

Radiograph summaries are deterministic drafts assembled from dentist-verified tooth numbers, dentist-created annotations, and linked EMR records. The raw image and pending predictions are not sent to the language model. The dentist may edit the draft and must explicitly approve it before it is returned to a patient or included in the AI Patient Engagement Module context.

An approved summary is displayed read-only. Starting a revision creates a separate `revisionDraft`; it does not overwrite `approvedText`. Existing patient-facing serialization continues to expose only the last approved text while the dentist edits the revision. Approving the revision replaces the approved text and clears the pending draft. Cancelling a revision clears only the pending draft and retains the previous approved text and approval metadata. The interface does not create multiple independent summaries for one radiograph.

## Dentist finding lifecycle

Dentist-recorded findings can be edited, archived, restored, or soft-deleted only through dentist-scoped radiograph endpoints. Each mutation stores the previous finding values, action, dentist, timestamp, and reason in the embedded audit history. Delete requires a reason and changes the finding status to `deleted`; it does not physically remove the clinical record.

Only active findings appear as image markers or contribute to new summaries, linked-treatment displays, patient radiograph payloads, or NgitiBot context. Archived findings remain restorable in the dentist review. Deleted findings remain retained for audit purposes but are hidden from active workflows. If active findings change after summary approval, the approved patient-facing text is preserved and marked as needing a dentist-approved revision.

## Internal evaluation status

No labeled enhancement dataset or diagnostic-performance claim is included in this repository. The previous tooth-region evaluation endpoint remains available for internal compatibility, but its metrics are not shown in the dentist Radiograph Review workflow because visual tooth suggestions are no longer part of that workflow. A future dental-specific denoiser requires a deidentified, modality-aware dataset and separate clinical validation.
