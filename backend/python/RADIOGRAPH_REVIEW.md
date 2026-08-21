# AI-Assisted Radiograph Review model note

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

## Confidence display

The application uses documented review bands:

- high: 0.85 or greater;
- medium: 0.60 through 0.8499;
- low: below 0.60.

The contour baseline intentionally caps its own confidence below 0.85 because it has not been clinically validated. Low-confidence regions are listed for dentists but hidden from the image overlay by default. Confidence is never called accuracy.

## Language layer

Radiograph summaries are deterministic drafts assembled from dentist-verified tooth numbers, dentist-created annotations, and linked EMR records. The raw image and pending predictions are not sent to the language model. The dentist may edit the draft and must explicitly approve it before it is returned to a patient or included in patient AI context.

## Evaluation status

Not yet evaluated. No labeled dataset, ground-truth tooth boxes, precision, recall, F1, IoU, or mAP results are included in this repository. The evaluation endpoint reports only counts, verification/correction rates, numbering accuracy on dentist-reviewed suggestions, and average confidence. Region metrics remain `null` until suitable ground truth exists.
