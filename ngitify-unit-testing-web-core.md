# UNIT TEST DOCUMENT - NGITIFY DENTIME

Scope: Web application unit test scenarios excluding Login Module and excluding the unfinished patient web dashboard / Daily Oral Health Log / Predictive Visit Window redesign.

Suggested common header per component:

| Field | Value |
|---|---|
| Test Cycle No. | 1 |
| Date Tested | __________________ |
| Type of System | Web Application |
| Actual Results | Attach screenshot during actual testing |
| Remarks | PASSED / FAILED |

## Module Name: Website Online Booking Module

Component Name: Public Appointment Request

Pre-conditions: Appointment page is open.

Action Description: Submit online booking request.

Verification Steps: Fill form, submit, and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Submit complete valid online booking request | Valid first name, valid last name, valid phone number format, valid email format, valid birthdate, selected gender, checked privacy consent, completed captcha, selected branch, valid future preferred date, available preferred time, configured online-booking procedure, optional notes blank | Success modal must display with title `Request received`. Appointment request must be created and visible in Schedule Records with pending status/source from website booking. |
| 2. Empty first name | Empty first name; other required fields valid | Field validation must display `First name is required.` Booking must not submit. |
| 3. Invalid first name format | First name with number/symbol; other required fields valid | Field validation must reject the value and the booking must not submit. |
| 4. Empty last name | Empty last name; other required fields valid | Field validation must display `Last name is required.` Booking must not submit. |
| 5. Invalid last name format | Last name with number/symbol; other required fields valid | Field validation must reject the value and the booking must not submit. |
| 6. Empty phone number | Empty phone number; other required fields valid | Field validation must display `Phone number is required.` Booking must not submit. |
| 7. Invalid phone number format | Invalid contact number format; other required fields valid | Field validation must reject the number. Booking must not submit. |
| 8. Empty email address | Empty email; other required fields valid | Field validation must display `Email address is required.` Booking must not submit. |
| 9. Invalid email format | Invalid email format; other required fields valid | Field validation must reject the email. Booking must not submit. |
| 10. Empty birthdate | Empty birthdate; other required fields valid | Field validation must display `Birthdate is required.` Booking must not submit. |
| 11. Empty gender | No gender selected; other required fields valid | Field validation must display `Gender is required.` Booking must not submit. |
| 12. Privacy consent unchecked | Privacy consent not checked; other required fields valid | Field validation must display `Please agree to the data privacy notice before submitting.` Booking must not submit. |
| 13. Captcha not completed | Empty captcha token; other required fields valid | Field validation must display `Please complete the captcha before submitting.` Booking must not submit. |
| 14. Captcha unavailable | Captcha site key/configuration unavailable | Field validation must display `Captcha is not configured yet. Please contact the clinic.` Booking must not submit. |
| 15. Empty branch | No branch selected; other required fields valid | Field validation must display `Branch is required.` Booking must not submit. |
| 16. Empty preferred date | Empty preferred date; other required fields valid | Field validation must display `Preferred date is required.` Booking must not submit. |
| 17. Invalid appointment date | Invalid date value | Error message must display `Please select a valid appointment date.` Booking must not submit. |
| 18. Sunday appointment date | Preferred date is Sunday | Error message must display `Appointments cannot be requested on Sundays.` Booking must not submit. |
| 19. Past appointment date | Preferred date is before current date | Error message must display `Please select today or a future date.` Booking must not submit. |
| 20. Same-day booking cutoff reached | Today's date selected after same-day booking cutoff | Helper/error must display `Same-day booking is no longer available for today. Please choose another date.` |
| 21. Empty preferred time | No preferred time selected; other required fields valid | Field validation must display `Preferred time is required.` Booking must not submit. |
| 22. Invalid appointment time | Invalid time value | Error message must display `Please select a valid appointment time.` Booking must not submit. |
| 23. Past appointment time today | Today selected with earlier time | Error message must display `Please choose a later appointment time.` Booking must not submit. |
| 24. Already taken slot | Selected time slot is already taken by another active schedule | Error modal must display `That time slot is no longer available. Please choose another time.` |
| 25. Fully booked selected date | Selected date reached maximum appointments per day | Error message/modal must display maximum appointment limit message and request another date. |
| 26. No available slots | Branch/date selected has no open slots | Page must display `No available slots for the selected date. Please choose another date.` |
| 27. Empty procedure | No procedure selected; other required fields valid | Field validation must display `Procedure is required.` Booking must not submit. |
| 28. Procedure not configured for online booking | Procedure value not included in configured online-booking procedures | Booking must be rejected and user must be told to choose an available procedure. |
| 29. Notes too short | Notes provided but less than required detail length | Field validation must display `Please provide a bit more detail or leave this blank.` |
| 30. Backend appointment service unavailable | Server does not expose website booking endpoint | Message must display `The website appointment service is not yet available on the live server. Please redeploy the backend first.` |
| 31. Network/server connection failure | Valid request while server is unreachable | Error message must display `Unable to connect to the server. Please try again.` |

Component Name: Guest Appointment Confirmation and Patient Registration

Pre-conditions: Guest appointment exists.

Action Description: Confirm guest appointment.

Verification Steps: Confirm record and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Confirm complete guest appointment | Valid guest first and last name, valid guest email, valid contact number, valid birthdate, selected gender, valid branch, assigned dentist, date, time, procedure | Toast must display `Guest appointment confirmed. A pre-registration link was sent to the guest.` Appointment status must change to confirmed and registration link must be generated/sent. |
| 2. Confirm guest appointment with missing guest name | Empty guest first name or last name | Error must display `Guest first and last name are required before confirming this appointment.` |
| 3. Confirm guest appointment with invalid guest email | Invalid guest email format | Error must display `A valid guest email is required before confirming this appointment.` |
| 4. Confirm guest appointment with missing contact number | Empty guest contact number | Error must display `Guest contact number is required before confirming this appointment.` |
| 5. Confirm guest appointment with missing birthdate/gender | Empty birthdate or empty gender | Error must display `Guest birthdate and gender are required before confirming this appointment.` |
| 6. Confirm guest appointment with missing branch | Empty branch | Error must display `Appointment branch is required before confirming this appointment.` |
| 7. Resend guest pre-registration link | Existing guest appointment with pre-registration link | Success toast/message must display `Pre-registration link resent successfully.` or backend success message. |
| 8. Resend pre-registration link fails | Existing guest appointment but server/email sending fails | Error toast must display `Unable to process guest appointment.` or returned backend message. |
| 9. Open invalid pre-registration link | Invalid token | Error must display `This link is invalid.` |
| 10. Open expired pre-registration link | Expired token | Error must display `This link has expired.` |
| 11. Open already completed pre-registration link | Token already completed | Error must display `You have already completed your registration.` |
| 12. Missing pre-registration token | Empty token | Error must display `Pre-registration token is required.` |

## Module Name: Patient Appointment Booking Module

Component Name: Registered Patient Booking

Pre-conditions: Patient is logged in.

Action Description: Submit patient booking request.

Verification Steps: Submit booking and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Submit valid patient booking request | Patient account with assigned branch, valid future date, available time, configured online-booking procedure | Toast must display `Appointment request submitted successfully.` Success modal must open. Request must appear in schedule records as pending. |
| 2. Patient has no assigned branch | Patient account with empty assigned branch | Modal/message must display `Your patient account does not have an assigned branch yet. Please contact the clinic before sending a web booking request.` |
| 3. Request submitted without assigned branch on backend | Patient account with empty assigned branch | Error must display `Your patient account does not have an assigned branch yet. Please contact the clinic before booking an appointment.` |
| 4. Booking branch does not match patient branch | Selected/posted branch differs from assigned branch | Error must display `Your booking branch does not match your assigned clinic branch.` |
| 5. Patient already has active appointment request | Existing pending/confirmed/in-clinic request | Error must display `You already have an active appointment request. Please wait for it to be completed or cancelled before booking another one.` |
| 6. Empty date | Empty appointment date | Error must display `Date, time, and procedure are required.` |
| 7. Empty time | Empty appointment time | Error must display `Date, time, and procedure are required.` |
| 8. Empty procedure | Empty procedure | Error must display `Date, time, and procedure are required.` |
| 9. Procedure not allowed for online booking | Procedure not in configured list | Error must display `Patients may only book one of the configured online-booking procedures. Additional procedures are recorded by the clinic after assessment or treatment.` |
| 10. Date at full capacity | Valid date with full branch capacity | UI must display `This day is already at full branch capacity. Please choose another date.` |
| 11. Appointment slots fail to load | Server error while loading slots | Error must display `Server error fetching appointment slots.` or client booking error. |
| 12. Booking request server failure | Valid request but server error | Error must display `Booking failed. Please try again.` or returned backend message. |

## Module Name: Schedule Management Module

Component Name: Schedule Entry Creation

Pre-conditions: Authorized user is logged in.

Action Description: Add schedule entry.

Verification Steps: Save entry and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Add valid appointment for registered patient | Source: registered patient; valid branch; selected patient; assigned dentist; valid contact number; future date; valid status; valid email; valid procedure; available time | Toast must display `Appointment created successfully.` Schedule entry must appear in calendar/list. |
| 2. Add valid walk-in appointment | Source: walk-in; valid branch; valid patient/guest details; procedure; queue/schedule details | Toast must display `Walk-in appointment added successfully.` Walk-in entry must appear in queue/schedule. |
| 3. Empty source | Empty source; other fields valid | Required field error must display for Source and record must not save. |
| 4. Empty branch | Empty branch; other fields valid | Required field error must display for Branch and record must not save. |
| 5. Empty registered patient | Source requires existing patient but patient not selected | Required patient field error must display and record must not save. |
| 6. Empty patient name for guest/walk-in | Guest/walk-in source with empty patient name | Required patient name error must display and record must not save. |
| 7. Empty dentist | No dentist selected | Required field error must display for Dentist and record must not save. |
| 8. Empty contact number | Empty contact number | Required field error must display for Contact Number and record must not save. |
| 9. Invalid contact number | Invalid contact number format | Field/backend error must display and record must not save. |
| 10. Empty date | Empty appointment date | Required field error must display for Date and record must not save. |
| 11. Invalid appointment date | Invalid date value | Error must display `Please select a valid appointment date.` |
| 12. Sunday appointment date | Date falls on Sunday | Error must display `Appointments cannot be requested on Sundays.` |
| 13. Past appointment date | Date earlier than current date | Error must display `Please select today or a future date.` |
| 14. Same-day cutoff reached | Today selected after same-day cutoff | Error/helper must display `Same-day booking is no longer available for today. Please choose another date.` |
| 15. Empty status | Empty status | Required field error must display for Status and record must not save. |
| 16. Empty email for guest/phone-call booking | Guest email required but empty | Required field error must display for Email Address and record must not save. |
| 17. Invalid email for guest/phone-call booking | Invalid email format | Field/backend error must display and record must not save. |
| 18. Empty procedure | Empty procedure | Required field error must display for Procedure and record must not save. |
| 19. Empty time | Empty time | Required field error must display for Time and record must not save. |
| 20. Taken time slot | Selected date/time/branch already has active schedule | Error must display `That time slot is no longer available. Please choose another time.` |
| 21. Maximum daily capacity reached | Date reached configured max appointments per day | Error must display maximum appointments message and record must not save. |
| 22. Access denied role | Unauthorized role opens or submits schedule action | Error must display `Access denied.` |
| 23. Branch mismatch | Branch-scoped user edits/adds record for another branch | Error must display `Access denied. This record belongs to a different branch.` or branch-specific access message. |
| 24. Server save failure | Valid input but server error | Toast must display `Could not save this schedule entry.` |

Component Name: Schedule Entry Editing

Pre-conditions: Schedule entry exists.

Action Description: Edit schedule entry.

Verification Steps: Save changes and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Edit valid schedule details | Valid updated branch/patient/dentist/contact/date/status/email/procedure/time | Toast must display `Appointment updated successfully.` Updated details must reflect in schedule list. |
| 2. Edit valid walk-in details | Valid updated walk-in data | Toast must display `Walk-in appointment updated successfully.` |
| 3. Edit completed appointment | Existing status: completed | Toast/info must display `Completed and cancelled schedules can no longer be edited.` |
| 4. Edit cancelled appointment | Existing status: cancelled | Toast/info must display `Completed and cancelled schedules can no longer be edited.` |
| 5. Reschedule with valid new date/time | New future date and available time | Message must display `Appointment rescheduled successfully.` Schedule must move to new date/time. |
| 6. Reschedule with empty new date/time | Empty new date or empty new time | Error must display `New date and time are required.` |
| 7. Reschedule to invalid/taken slot | Taken time slot or invalid date/time | Error must display slot/date validation message. |
| 8. Reassign dentist | Valid different dentist | Appointment must update and dentist notification must be generated. |
| 9. Update notes | Valid internal note text | Notes must save and schedule record must show updated note. |
| 10. Dentist edits appointment not assigned to them | Dentist account tries to edit unassigned appointment | Error must display `Access denied. This appointment is not assigned to this dentist.` |
| 11. Branch user edits appointment from other branch | Branch-scoped user opens other branch appointment | Error must display `Access denied. This appointment belongs to a different branch.` |
| 12. Backend update failure | Valid edit but server error | Toast/error must display `Error updating dental treatment.` or `Could not save this schedule entry.` |

Component Name: Schedule Status Management

Pre-conditions: Appointment exists.

Action Description: Update schedule status.

Verification Steps: Save status and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Confirm pending appointment | Status: confirmed; valid assigned dentist/date/time/procedure | Toast must display `Appointment updated to Confirmed.` Patient notification must state appointment is confirmed. |
| 2. Mark confirmed appointment as in-clinic | Status: in-clinic | Toast must display `Appointment updated to In Clinic.` Patient notification must state appointment has been checked in and is now in clinic. |
| 3. Mark eligible appointment completed | Status: completed; valid performed procedure; treatment category; valid amount charged; valid amount paid; optional next appointment valid | Toast must display `Schedule marked as completed.` Treatment log must be created in patient EMR. |
| 4. Complete future appointment | Status: completed while scheduled date/time is future | Error must display `Appointments can only be marked completed after their scheduled date and time.` |
| 5. Complete appointment without checked-in/past condition | Appointment not past or not checked in where required | Toast must display `Only past or checked-in appointments can be marked as completed.` |
| 6. Complete appointment without treatment details | Missing performed procedure/category/payment details | Error must display `Please complete the treatment details before marking this schedule as complete.` |
| 7. Complete appointment with empty performed procedure | Empty performed procedure | Error must display `Please select the procedure performed before completing the appointment.` |
| 8. Complete appointment with invalid performed procedure | Invalid performed procedure value | Error must display `Please select a valid performed procedure.` |
| 9. Complete appointment with empty treatment category | Empty treatment category | Error must display `Please select a treatment category before completing the appointment.` |
| 10. Complete appointment with empty amount charged/paid | Empty amount charged or amount paid | Error must display `Please provide the amount charged and amount paid before completing the appointment.` |
| 11. Complete appointment with invalid amount | Negative/non-numeric amount charged or paid | Error must display `Amount charged and amount paid must be valid positive numbers.` |
| 12. Complete appointment with invalid next appointment date | Invalid next appointment date | Error must display `Next appointment must be a valid date.` |
| 13. Cancel appointment with reason | Status: cancelled; valid cancellation reason | Toast must display `Appointment updated to Cancelled.` Patient notification must display appointment cancelled message. |
| 14. Cancel without reason when required by UI | Empty cancellation reason | UI must require/record cancellation reason or default reason `Cancelled by clinic staff.` |
| 15. Change terminal status | Existing status completed/cancelled then attempt new status | Error must display `Cannot change status of a completed or cancelled appointment.` |
| 16. Invalid status value | Status outside pending/confirmed/in-clinic/completed/cancelled | Error must display `Invalid status value.` |
| 17. Invalid status transition | Status transition not allowed from current status | Error must display `Status can only be updated to [allowed status] from [current status].` |
| 18. Status update server failure | Valid status change but server error | Toast must display `Failed to update the appointment status.` |
| 19. Auto-cancel overdue appointment | Confirmed appointment past grace period with no check-in | Status must become cancelled, reason must be `Auto-cancelled: patient did not check in within 15 minutes of the appointment time.`, and notification must display `Appointment Auto-cancelled`. |

Component Name: Schedule Removal / Archive

Pre-conditions: Appointment exists.

Action Description: Remove/archive schedule.

Verification Steps: Confirm action and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Remove/archive appointment | Existing active appointment | Appointment must be archived successfully with message `Appointment archived successfully.` |
| 2. Remove non-existing appointment | Invalid appointment ID | Error must display `Dental treatment not found`. |
| 3. Unauthorized remove | Role without permission | Error must display `Access denied.` |
| 4. Branch mismatch remove | Branch-scoped user removes other branch appointment | Error must display `Access denied. This record belongs to a different branch.` |
| 5. Dentist removes unassigned appointment | Dentist account removes appointment assigned to another dentist | Error must display `Access denied. This appointment is not assigned to this dentist.` |
| 6. Server delete failure | Valid request but server error | Error must display `Error deleting dental treatment.` |

Component Name: Schedule Record Filters

Pre-conditions: Schedule records exist.

Action Description: User filters schedule records.

Verification Steps: Apply filters and check displayed records.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Filter by patient name - existing | Patient search with existing patient name | Only records matching the patient name must display. |
| 2. Filter by patient name - partial | Partial patient name | Records containing the partial name must display. |
| 3. Filter by patient name - no match | Patient name with no matching record | Empty/no matching schedule records must display. |
| 4. Filter by procedure - existing | Procedure filter/search with existing procedure | Only records with selected/matching procedure must display. |
| 5. Filter by procedure - no match | Procedure with no matching record | No matching records must display. |
| 6. Filter by dentist - existing | Selected dentist with assigned schedules | Only records assigned to selected dentist must display. |
| 7. Filter by dentist - no assigned schedule | Dentist with no records in selected range | No matching records must display. |
| 8. Filter by branch | Selected branch | Only records from selected branch must display. |
| 9. Filter by type/source | Type/source: registered patient, website booking, phone call, walk-in | Only matching schedule type/source must display. |
| 10. Filter by status pending | Status: pending | Only pending records must display. |
| 11. Filter by status confirmed | Status: confirmed | Only confirmed records must display. |
| 12. Filter by status in-clinic | Status: in-clinic | Only in-clinic records must display. |
| 13. Filter by status completed | Status: completed | Only completed records must display. |
| 14. Filter by status cancelled | Status: cancelled | Only cancelled records must display. |
| 15. Filter by single date | From date and to date equal same valid date | Only records for selected date must display. |
| 16. Filter by date range | Valid from date and valid to date | Only records within date range must display. |
| 17. Invalid date range | Invalid from/to date value | Error must display `Invalid appointment date range.` |
| 18. Combined filters | Patient name + procedure + dentist + branch + type + status + date range | Only records matching all selected filters must display. |
| 19. Clear filters | Filters applied, then cleared | Full schedule list for default date range must display again. |
| 20. Print/export schedule report | Current filtered results | Report title must display `Schedule Records Report` / `Schedule Listing` and include only filtered records. |

## Module Name: Manage Patients Module

Component Name: Add Patient

Pre-conditions: Add Patient form is open.

Action Description: Add patient profile.

Verification Steps: Submit form and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Add complete valid patient | Valid first name, valid last name, valid birthdate, selected gender, valid email format, assigned branch, valid address/contact/medical fields, required yes/no fields answered, privacy consent acknowledged | Success modal must display `New patient has been successfully added to the system.` Patient must appear in patient list. |
| 2. Empty first name | Empty first name; other required fields valid | Field error must display `Required` and patient must not be added. |
| 3. Invalid first name format | First name with number/symbol | Validation must reject the name using patient person-name rules. |
| 4. Empty last name | Empty last name | Field error must display `Required` and patient must not be added. |
| 5. Invalid last name format | Last name with number/symbol | Validation must reject the name using patient person-name rules. |
| 6. Empty birthdate | Empty birthdate | Field error must display `Required`. |
| 7. Empty gender | Empty gender | Field error must display `Required`. |
| 8. Empty email | Empty email | Field error must display `Required` or backend must display `A valid patient email address is required.` |
| 9. Invalid email format | Invalid email format | Backend/client validation must display `A valid patient email address is required.` |
| 10. Duplicate email | Email already used by another account | Error must display `This email address is already in use by another account.` |
| 11. Empty branch for non-branch-manager | No assigned branch selected | Branch required error must display and patient must not be added. |
| 12. Branch manager adds patient | Branch-manager account; branch field auto-assigned | Patient must be assigned to branch manager's assigned branch. |
| 13. Required yes/no medical fields empty | Empty required yes/no fields | Required field errors must display and patient must not be added. |
| 14. Minor patient without guardian details | Patient age below guardian threshold; empty guardian name/relationship/occupation | Guardian required errors must display and patient must not be added. |
| 15. Invalid guardian contact | Invalid guardian contact number | Field validation must reject the value. |
| 16. Invalid emergency contact name | Emergency contact name with number/symbol | Validation must reject the value. |
| 17. Privacy notice not fully viewed | Consent checkbox attempted before full notice viewed | Consent acknowledgement checkbox must remain disabled or user must be prompted to review full notice. |
| 18. Server add patient failure | Valid form but server error | Alert/error must display returned backend message or `Failed to add patient`. |
| 19. Cannot connect to server | Valid form while server unreachable | Alert must display `Cannot connect to server.` |

Component Name: Edit Patient

Pre-conditions: Patient record exists.

Action Description: Edit patient profile.

Verification Steps: Save changes and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Edit patient with valid changes | Valid updated name/contact/address/medical details; valid email format; consent valid | Success modal must display `The patient's profile has been successfully updated.` |
| 2. Empty required field | Empty required first name/last name/birthdate/gender/email | Required field error must display and profile must not update. |
| 3. Invalid person-name field | Invalid patient/guardian/emergency/physician/consent signer name | Error must display the corresponding invalid person-name message. |
| 4. Invalid email format | Invalid email format | Error must display `A valid patient email address is required.` |
| 5. Duplicate email on edit | New email already used by another account | Error must display `This email address is already in use by another account.` or `Email already exists.` |
| 6. Attempt direct branch reassignment | Change branch through edit form instead of Transfer Branch action | Error must display `Patient branch reassignment must be done through the dedicated Transfer Branch action so upcoming appointments and branch ownership can be reviewed first.` |
| 7. Edit archived patient | Patient is archived | Error must display `Restore this archived patient before editing the record.` |
| 8. Patient not found | Invalid patient ID | Error must display `Patient not found`. |
| 9. Patient from different branch | Branch-scoped user edits patient from another branch | Error must display `Access denied. This patient belongs to a different branch.` |
| 10. Dentist edits unassigned patient | Dentist edits patient not assigned to dentist | Error must display `Access denied. This patient is not assigned to this dentist.` |
| 11. Failed to load patient data | Open edit page while fetch fails | Alert must display `Failed to load patient data.` |
| 12. Cannot connect while loading | Server unreachable while loading patient | Alert must display `Cannot connect to server.` |
| 13. Server update failure | Valid edit but server error | Alert must display returned backend message or `Failed to update patient`. |
| 14. Cannot connect on update | Valid edit while server unreachable | Alert must display `Cannot connect to server.` |

Component Name: Patient List and Filters

Pre-conditions: Patient records exist.

Action Description: Filter patient records.

Verification Steps: Apply filters and check displayed records.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Search patient by full name | Existing full patient name | Only matching patient must display. |
| 2. Search patient by partial name | Partial patient name | Matching patients containing the partial text must display. |
| 3. Search patient by email | Existing email format | Matching patient record must display. |
| 4. Search with no match | Non-existing name/email | No matching patient records must display. |
| 5. Filter all lifecycle states | Lifecycle filter: all | Active, inactive, and allowed visible records must display. |
| 6. Filter active patients | Lifecycle filter: active | Only active patients must display. |
| 7. Filter inactive patients | Lifecycle filter: inactive | Only inactive patients must display. |
| 8. Filter archived patients | Lifecycle filter: archived | Only archived patients must display when archive visibility is allowed. |
| 9. Filter by branch | Selected branch | Only patients assigned to selected branch must display. |
| 10. Combined search and branch/lifecycle filter | Patient search + selected branch + lifecycle status | Only records matching all filters must display. |
| 11. Print patient list report | Current filtered patient list | Report title must display `Patient List Report` / `Patients` and include only filtered records. |
| 12. Open patient EMR from list | Existing patient record | Patient EMR page must open for selected patient. |
| 13. Open patient profile from list | Existing patient record | Patient profile/details page must open. |
| 14. Unauthorized list access | User without patient-read permission | Access must be denied or patient list must not load. |

Component Name: Patient Branch Transfer

Pre-conditions: Patient has assigned branch.

Action Description: Transfer patient branch.

Verification Steps: Submit transfer and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Valid branch transfer | Current branch exists; selected different active target branch; valid transfer reason | Toast must display backend message such as `Patient branch transferred from [current branch] to [target branch].` Patient branch must update. |
| 2. Empty target branch | No target branch selected | Toast/field error must display `Please select the target branch.` or `Target branch is required.` |
| 3. Empty transfer reason | Target branch selected; empty reason | Toast/field error must display `Please provide a transfer reason.` or `Transfer reason is required.` |
| 4. Same target branch | Target branch same as current branch | Error must display `Select a different target branch before submitting the transfer.` |
| 5. Patient has no current branch | Current assigned branch empty | Error must display `This patient does not have a current assigned branch yet. Fix the patient branch assignment first before transferring.` |
| 6. Target branch does not exist | Invalid target branch | Error must display `The selected target branch does not exist.` |
| 7. Target branch inactive | Inactive branch selected | Error must display `The selected target branch is inactive and cannot receive patient transfers.` |
| 8. Archived patient transfer | Patient is archived | Error must display `Restore this archived patient before transferring branches.` |
| 9. Transfer blocked by branch issues | Branch transfer preview has blockers | Error must display `This patient branch transfer is blocked until the listed branch issues are resolved.` |
| 10. Unauthorized transfer | User without transfer permission | Error must display `Access denied.` |
| 11. Different branch access | Branch-scoped user transfers patient outside allowed branch | Error must display `Access denied. This patient belongs to a different branch.` |
| 12. Server transfer failure | Valid transfer but server error | Error must display `Server error transferring patient branch.` or `Failed to transfer patient branch.` |
| 13. Cannot connect during transfer | Server unreachable | Toast must display `Cannot connect to server.` |

Component Name: Patient Activation / Deactivation

Pre-conditions: Patient record exists.

Action Description: Activate/deactivate patient.

Verification Steps: Confirm action and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Deactivate active patient with reason | Active patient; valid deactivation reason | Confirmation modal title must display `Deactivate Account`. Confirm button must display `Yes, Deactivate`. Success toast must display `Successfully deactivated [name]'s account.` |
| 2. Cancel deactivate confirmation | Active patient; click cancel in confirmation modal | Patient status must remain active. No success toast must display. |
| 3. Deactivate without reason | Empty deactivation reason where required | Error must display `A reason is required when deactivating a patient account.` |
| 4. Activate inactive verified patient | Inactive patient with verified email | Confirmation modal title must display `Activate Account`. Confirm button must display `Yes, Activate`. Success toast must display `Successfully activated [name]'s account.` |
| 5. Activate unverified patient | Inactive patient with unverified email | Toast must display `Cannot activate [name]. Their email is not yet verified.` or backend `Cannot activate patient. Email is not yet verified.` |
| 6. Change status of archived patient | Archived patient | Toast/error must display `Restore [name] from archive before changing activation status.` or backend `Restore this archived patient before changing activation status.` |
| 7. Deactivate blocked patient | Patient has lifecycle blockers | Error must display blocker message or `This patient account cannot be deactivated yet.` |
| 8. Invalid status value | Status not active/inactive | Error must display `Status must be either active or inactive.` |
| 9. Patient not found | Invalid patient ID | Error must display `Patient not found.` |
| 10. Unauthorized status change | User without permission | Error must display `Access denied.` |
| 11. Server status failure | Valid status action but server error | Error must display `Failed to update status.` or `Server error.` |
| 12. Cannot connect status action | Server unreachable | Toast must display `Cannot connect to server.` |

Component Name: Patient Archive / Restore

Pre-conditions: Patient record exists.

Action Description: Archive/restore patient.

Verification Steps: Confirm action and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Archive active patient | Existing non-archived patient | Confirmation modal title must display `Archive Patient`. Confirm button must display `Yes, Archive`. Toast must display `[name] has been archived successfully.` |
| 2. Cancel archive confirmation | Existing non-archived patient; click cancel | Patient must remain active/non-archived. |
| 3. Restore archived patient | Archived patient | Confirmation modal title must display `Restore Patient`. Confirm button must display `Yes, Restore`. Patient must return to active patient list according to status. |
| 4. Archive with EMR history | Patient has treatment logs/radiographs/odontogram history | Warning/impact details must preserve EMR content; archive must not delete clinical history. |
| 5. Archive with upcoming appointments | Patient has upcoming appointments | Lifecycle warning must display upcoming appointment impact before confirmation. |
| 6. Archive action fails | Server rejects archive | Toast must display returned message or `Failed to update archive status.` |
| 7. Cannot connect archive action | Server unreachable | Toast must display `Cannot connect to server.` |
| 8. Restore from Archive Review | Archived patient visible in Archive Review | Restore confirmation must display and patient must be restored after confirm. |
| 9. Delete archived record before retention | Archived record below retention period | Blocker must display retention message and permanent delete must not proceed. |
| 10. Delete patient with preserved clinical records | Archived patient with appointment/treatment/radiograph/odontogram/queue/material usage records | Blocker must display preservation message and permanent delete must not proceed. |

Component Name: Patient Access Email

Pre-conditions: Patient record exists.

Action Description: Send patient access email.

Verification Steps: Click action and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Resend activation to unverified patient | Unverified patient account | Success message must display `Activation email has been resent successfully.` |
| 2. Resend activation to verified patient | Verified patient account | Error must display `This patient account is already verified.` |
| 3. Resend activation for archived patient | Archived patient | Error/toast must display `Restore this archived patient before resending activation.` |
| 4. Reissue access to inactive unactivated patient | Patient has not activated account | Success message must display `A new activation email has been sent so the patient can set their password.` |
| 5. Reissue access to activated patient | Patient already activated account | Error must display `This patient already activated their account. Use the normal password reset flow instead.` |
| 6. Reissue access for archived patient | Archived patient | Toast/error must display `Restore [name] from archive before reissuing access.` or backend `Restore this archived patient before reissuing access.` |
| 7. Email action patient not found | Invalid patient ID | Error must display `Patient not found.` |
| 8. Email action unauthorized | User lacks lifecycle permission | Error must display `Access denied.` |
| 9. Email server failure | Email service/server error | Error must display `Server error while resending activation email.` or `Server error while reissuing patient access.` |
| 10. Cannot connect email action | Server unreachable | Toast must display `Cannot connect to server.` |

## Module Name: Patient EMR Module

Component Name: Patient Record Viewing and Medical History

Pre-conditions: Patient EMR exists.

Action Description: View/update patient EMR.

Verification Steps: Open/update EMR and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Open existing patient EMR | Valid patient record ID within user's branch/assignment | Patient EMR must load profile, medical history, treatment history, odontogram, and radiograph sections. |
| 2. Patient record fails to load | Valid patient ID but server error | Toast must display `Failed to load patient record.` |
| 3. Cannot connect to EMR server | Server unreachable while loading EMR | Toast must display `Could not connect to the server.` |
| 4. Patient not found | Invalid patient ID | Error must display `Patient not found.` |
| 5. Patient views own EMR | Patient role opens own records | Own EMR/records must display. |
| 6. Patient views another patient's EMR | Patient role opens another patient ID | Error must display access-denied message such as `Patients can only view their own record.` |
| 7. Branch mismatch EMR access | Branch-scoped user opens patient from different branch | Error must display `Access denied. This patient belongs to a different branch.` |
| 8. Dentist opens unassigned patient | Dentist opens patient not assigned to them | Error must display `Access denied. This patient is not assigned to this dentist.` |
| 9. Update medical history successfully | Valid medical history and dental history fields | Toast must display `Medical history updated successfully.` Updated values must persist after reload. |
| 10. Update medical history fails | Invalid update or server error | Toast must display `Failed to update medical history.` or returned backend message. |

Component Name: Treatment Logs

Pre-conditions: Patient EMR is open.

Action Description: Manage treatment logs.

Verification Steps: Save/delete log and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Add valid treatment log | Valid date, procedure, treatment category, branch, valid amount charged, valid amount paid, optional next appointment valid | Toast must display `Treatment log added successfully.` Treatment entry must appear in EMR. |
| 2. Empty date | Empty treatment date | Error must display `Date and procedure are required.` |
| 3. Empty procedure | Empty procedure | Error must display `Date and procedure are required.` |
| 4. Empty branch | Empty branch | Error must display `Branch is required.` |
| 5. Invalid amount charged | Negative/non-numeric amount charged | Error must display `Amount charged and amount paid must be valid positive numbers.` |
| 6. Invalid amount paid | Negative/non-numeric amount paid | Error must display `Amount charged and amount paid must be valid positive numbers.` |
| 7. Invalid next appointment date | Invalid next appointment date | Error must display `Next appointment must be a valid date.` |
| 8. Secretary adds treatment log | Secretary role submits treatment log | Error must display `Access denied. Secretaries have read-only access to treatment logs.` |
| 9. Dentist adds log to unassigned patient | Dentist role, patient not assigned | Error must display `Access denied. This patient is not assigned to this dentist.` |
| 10. Add log server failure | Valid input but server error | Toast/error must display `Failed to save treatment log.` or `Server error adding treatment log.` |
| 11. Delete existing treatment log | Existing log ID | Success message must display `Treatment log deleted successfully.` Log must be removed from EMR. |
| 12. Delete missing treatment log | Invalid log ID | Error must display `Log entry not found.` |
| 13. Delete log without permission | Unauthorized role | Error must display `Access denied.` |

## Module Name: Interactive Digital Odontogram Module

Component Name: Dental Chart Viewing and Saving

Pre-conditions: Odontogram page is open.

Action Description: Update odontogram.

Verification Steps: Save tooth update and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Load existing odontogram | Valid patient ID | Dental chart must load with current tooth data. |
| 2. Load odontogram server failure | Valid patient ID but server error | Toast must display `Could not load the odontogram.` or `Server error fetching odontogram.` |
| 3. No patient selected | Empty patient ID then save | Toast must display `No patient selected. Cannot save the dental chart.` |
| 4. Save healthy tooth state | Tooth number selected; status healthy; surfaces empty; notes optional | Toast must display `Tooth [number] updated successfully.` Tooth state must persist. |
| 5. Save decayed tooth with surface | Tooth selected; condition decayed; surface selected; stage existing; notes valid | Toast must display `Tooth [number] updated successfully.` Odontogram must show updated condition/surface. |
| 6. Save filled/crown/missing/implant condition | Tooth selected; selected clinical condition; stage existing/planned/completed | Toast must display success and selected condition must be visible on chart. |
| 7. Save invalid odontogram payload | Invalid tooth/surface/status payload | Error must display returned validation message from backend. |
| 8. Secretary attempts to save odontogram | Secretary role saves chart | Error must display `Access denied. Secretaries have read-only access to odontogram.` |
| 9. Dentist saves unassigned patient odontogram | Dentist role, patient not assigned | Error must display `Access denied. This patient is not assigned to this dentist.` |
| 10. Patient views own odontogram | Patient role opens own odontogram | Read-only odontogram must display. |
| 11. Patient views another odontogram | Patient role opens other patient ID | Error must display `Access denied. Patients can only view their own odontogram.` |
| 12. Load odontogram history | Patient has odontogram logs | History panel must display previous tooth updates. |
| 13. Odontogram history fails to load | Server error while loading logs | Toast must display `Failed to load odontogram history.` |
| 14. Patient views own odontogram history | Patient role opens own history | Own history must display if supported by the web route. |
| 15. Patient views another history | Patient role opens other patient history | Error must display `Access denied. Patients can only view their own odontogram history.` |
| 16. Save odontogram server failure | Valid chart update but server error | Toast must display `Failed to save the odontogram.` or `Server error saving odontogram.` |

## Module Name: Radiograph Module

Component Name: Radiograph Upload, Viewing, Delete, and Enhancement

Pre-conditions: Patient EMR is open.

Action Description: Manage radiographs.

Verification Steps: Upload/enhance/delete and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. View patient radiographs | Valid patient ID with radiograph records | Radiograph list/images must display. |
| 2. No radiograph exists | Patient has no uploaded radiograph | UI must display `No radiograph image uploaded.` |
| 3. Upload valid radiograph | Image file under 3MB, valid label, valid date, optional radiograph number/findings/notes | Toast must display `Radiograph uploaded successfully.` Radiograph must appear in EMR and patient notification must be created. |
| 4. Upload image over size limit | Image file greater than 3MB | Toast must display `Image must be under 3MB.` |
| 5. Empty label | Empty label; valid date and image | Toast/error must display `Label and date are required.` |
| 6. Empty date | Valid label; empty date and image | Toast/error must display `Label and date are required.` |
| 7. No image selected | Valid label/date; no image file | Toast must display `Please select an image file.` |
| 8. Secretary uploads radiograph | Secretary role uploads image | Error must display `Access denied. Secretaries cannot upload radiographs.` |
| 9. Dentist uploads to unassigned patient | Dentist role, patient not assigned | Error must display `Access denied. This patient is not assigned to this dentist.` |
| 10. Upload server failure | Valid upload but server error | Toast/error must display `Failed to upload radiograph.` or `Server error adding radiograph.` |
| 11. Select radiograph and enhance | Dentist role; existing radiograph selected; enhancer configured | Toast/message must display returned success such as `Enhanced radiograph saved to the patient record.` Enhanced image version must be available. |
| 12. Enhance without selected radiograph | No radiograph selected | Toast must display `Select a radiograph first.` |
| 13. Non-dentist uses enhancer | Non-dentist role triggers enhancer | Toast must display `Only dentists can use the AI image enhancer for radiographs.` |
| 14. Self-hosted enhancement running | Self-hosted enhancer selected | UI must display `Running self-hosted AI enhancement...` while processing. |
| 15. Enhancement fails | Enhancer dependency/API/server failure | Toast/error must display `Failed to enhance radiograph.` or returned backend message. |
| 16. Delete existing radiograph | Existing radiograph entry ID | Message must display `Radiograph entry deleted successfully.` Entry must be removed. |
| 17. Delete missing radiograph | Invalid radiograph entry ID | Error must display `Radiograph entry not found.` |
| 18. Secretary deletes radiograph | Secretary role deletes radiograph | Error must display `Access denied. Secretaries cannot delete radiographs.` |
| 19. Patient views own radiographs | Patient role opens own radiographs | Own radiograph records must display read-only. |
| 20. Patient views another patient's radiographs | Patient role opens other patient ID | Error must display `Access denied. Patients can only view their own radiographs.` |

## Module Name: Supply and Stock Monitoring Module

Component Name: Inventory Tracker

Pre-conditions: Inventory page is open.

Action Description: Manage inventory stock.

Verification Steps: Save/delete/filter and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Load inventory list | Existing inventory records | Inventory table must display item, category, branch, stock, threshold, and batch details. |
| 2. Inventory load failure | Server error while loading inventory | Toast must display `Failed to load inventory data.` |
| 3. Add valid inventory item/batch | Valid item name, category, unit, brand, valid quantity received, valid low-stock threshold, branch, expiration date where applicable | Item/batch must save and appear in Inventory Tracker. |
| 4. Empty item name | Empty item name | Error must display `Item name is required.` |
| 5. Empty category | Empty category | Error must display `Category is required.` |
| 6. Empty unit | Empty unit | Error must display `Unit is required.` |
| 7. Empty brand | Empty brand | Error must display `Brand is required.` |
| 8. Empty quantity | Empty quantity received | Error must display `Quantity is required.` |
| 9. Invalid quantity | Negative/non-numeric quantity | Error must reject the quantity and item/batch must not save. |
| 10. Low stock threshold reached | Current stock less than or equal to threshold | Item must be marked low-stock and notification/alert must be visible where configured. |
| 11. Delete stock batch | Existing stock batch selected; confirmation accepted | Confirmation message must ask permanent delete. Toast must display `Stock batch deleted successfully.` |
| 12. Cancel delete stock batch | Existing stock batch selected; confirmation cancelled | Stock batch must remain in tracker. |
| 13. Delete stock batch fails | Server rejects delete | Toast must display `Failed to delete stock batch.` or returned backend message. |
| 14. Cannot connect during delete | Server unreachable | Toast must display `Cannot connect to server.` |
| 15. Unauthorized inventory access | Role without inventory permission | Error must display `Access denied.` |

Component Name: Material Usage Log

Pre-conditions: Completed appointment exists.

Action Description: Log material usage.

Verification Steps: Save usage and check message/result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Load completed appointments | Dentist has completed appointments | Completed appointment list must display. |
| 2. Completed appointments fail to load | Server error while loading | Toast must display `Could not load your completed appointments.` |
| 3. Select appointment and log valid material usage | Valid completed appointment, selected inventory item, valid quantity used within available stock | Toast must display `Material usage log saved and inventory deducted.` or `Materials successfully logged and deducted from inventory.` |
| 4. Empty appointment | No appointment selected | Toast must display `Please select a patient appointment.` |
| 5. Empty item | Empty inventory item in a row | Toast must display `Please select an item and valid quantity for all rows.` |
| 6. Invalid quantity | Empty/zero/negative/non-numeric quantity | Toast must display `Please select an item and valid quantity for all rows.` |
| 7. Quantity exceeds stock | Quantity used greater than available stock | Error must display returned insufficient-stock message and stock must not go negative. |
| 8. Deduct multiple valid items | Multiple selected items with valid quantities | Backend message must display `All materials successfully deducted.` and all stock counts must decrease. |
| 9. Deduct with empty itemsUsed array | Empty itemsUsed array | Error must display `itemsUsed array is required.` |
| 10. Save material usage server failure | Valid log but server error | Toast must display `Failed to save log.` |
| 11. Deduct inventory server failure | Valid log but deduction fails | Toast/error must display `Failed to deduct inventory.` or `Server error deducting inventory.` |
| 12. Load usage logs failure | Server error on logs page | Toast must display `Failed to load material usage logs.` |

## Module Name: Notifications and Activity Logs Module

Component Name: Notifications

Pre-conditions: Notifications exist.

Action Description: Manage notifications.

Verification Steps: Mark notification and check result.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. View notifications | Existing notifications | Notification list must display latest notifications. |
| 2. Mark notification as read | Existing unread notification ID | Notification must become read. |
| 3. Mark notification as unread | Existing read notification ID | Notification must become unread. |
| 4. Mark all as read | Multiple unread notifications | Message must display `All notifications marked as read.` and unread count must become zero. |
| 5. Invalid notification audience | Invalid audience value | Error must display `Invalid notification audience.` |
| 6. Notification not found | Invalid notification ID | Error must display `Notification not found.` |
| 7. Unauthorized notification access | User opens notification not belonging to them | Error must display `Access denied.` |
| 8. Notifications server error | Server error on notification action | Error must display `Server error.` |

Component Name: Activity Logs / Audit Trail

Pre-conditions: Activity logs exist.

Action Description: View activity logs.

Verification Steps: Open logs and check entries.

| Test Scenario | Data (Input Values) | Expected Results |
|---|---|---|
| 1. Appointment created log | Create valid appointment | Activity/audit log must show appointment creation action with user and timestamp. |
| 2. Appointment status update log | Change appointment status | Activity/audit log must show status change details. |
| 3. Patient profile update log | Edit valid patient profile | Activity/audit log must show updated patient information. |
| 4. Patient branch transfer log | Transfer patient to another branch | Activity/audit log must show branch transfer details and actor. |
| 5. Odontogram update log | Save tooth update | Odontogram history/audit must show tooth update, actor, role, and timestamp. |
| 6. Radiograph upload log/notification | Upload valid radiograph | Audit/notification trail must show radiograph upload availability. |
| 7. Material usage log | Save material usage | Activity/audit log must show usage and inventory deduction details. |
| 8. Unauthorized log access | User without permission opens audit logs | Access must be denied. |
