# WEB

## 1. WEBSITE ONLINE BOOKING MODULE / WEBSITE APPOINTMENT REQUEST
Preconditions: Appointment page is open
Action: Submit online booking request
Verification: Fill form, submit, and check message/result
- 1 | Complete required fields => Success modal must display with title “Request received”
- 2 | Empty required field => The message must display “Field is required”
- 3 | Invalid Phone Number format => The message must display “Phone number must start with 9”
- 4 | Invalid Email Address format => The message must display “Enter a valid email address”
- 5 | Privacy Policy not checked => The message must display “Please agree to the data privacy notice before submitting”
- 6 | Captcha not completed => The message must display “Please compete the Captcha before submitting”

## 2. REGISTRATION MODULE / PATIENT PRE-REGISTRATION
Preconditions: Unregistered patient booked an appointment online
Action: Pre-register patient form must be validated
Verification: Complete pre-registration form and check email for link verification
- 1 | Complete and valid required fields => The message must display “Thank you! Your registration details have been completed. Please check your email for the activation link sent by the clinic, then open it and set up your password.”
- 2 | Empty required fields => The message must display “Required”
- - | Patient is a minor => The guardian information must be required
- 3 | Invalid home phone number format => The message must display “Invalid landline format”
- 4 | Invalid work phone number format => The message must display “Invalid landline format”
- 5 | Invalid mobile number format => The message must display “Invalid format (9xxxxxxxxx)”
- 6 | Data and Privacy Consent not acknowledge => The message must display “Please review the full data privacy notice before submitting”
- 7 | Digital Dental Consent not acknowledge => The message must display “Please review the full consent form before submitting”
- - | Invalid, expired, or already completed pre-registration link => The message must display “This link has expired or is invalid. Please contact the clinic for assistance.”

## 3. REGISTRATION MODULE / SET-UP PASSWORD
Preconditions: Staff/patient already registered
Action: The password must be validated
Verification: The password must set and the login page must display
- 1 | Password and confirm password matched => The message must display “Account activated successfully. Your password is now set.”
- 2 | Invalid password format => The enter button must be disabled
- 3 | Password and confirm password do not match => The message must display “Passwords do not match”
- 4 | Empty password and confirm new password => The Activate Account button must be disabled
- - | Invalid or expired activation link => The message must display “Activation Unavailable. Invalid or expired activation link.”

## 4. LOGIN MODULE / LOGIN
Preconditions: Browser opened; account exists
Action: The email and password must be validated
Verification: The dashboard must display
- 1 | Correct email and password => The dashboard must display
- 2 | Correct email and incorrect password => The message must display “Invalid email or password”
- 3 | Incorrect email and correct password => The message must display “Invalid email or password”
- 4 | Incorrect email and password => The message must display "Invalid email and password"
- 5 | Empty email and password => The message must display “Email address is required” and “Password is required”
- 6 | Too many failed login attempts => The message must display “Too many login attempts. Please try again in 15 minutes.”

## 5. LOGIN MODULE / FORGOT PASSWORD
Preconditions: Click “Forgot Password” on the login page
Action: The email must be validated
Verification: The verification methods page must display
- 1 | Enter email address => The verification code page must display
- 2 | Empty email address field => The message must display “Please enter your email address”

## 6. LOGIN MODULE / FORGOT PASSWORD - OTP
Preconditions: Enter email in the Forgot Password page
Action: The OTP must be validated
Verification: The reset password page must display
- 1 | Correct OTP => The reset password page must display
- 2 | Incorrect OTP => The message must display “Invalid or expired OTP”
- 3 | Resend OTP => The message must display “New code sent” and the resend countdown must restart

## 7. LOGIN MODULE / RESET PASSWORD
Preconditions: Enter the valid OTP in the OTP page
Action: The new and confirm new password must be validated
Verification: The password must be reset and the login page must display
- 1 | New and confirm new password matched => The Successful Password Change page must display
- 2 | Invalid new password format => The enter button must be disabled
- 3 | New and confirm new password do not match => The message must display “Passwords do not match”
- 4 | Empty new password and confirm new password => The enter button must be disabled

## 8. ACCOUNT SETTINGS MODULE / EDIT PROFILE
Preconditions: Login in, click the “My Profile” from the sidebar and click “Edit Profile”
Action: The user details must be validated
Verification: The user details must be updated
- 1 | Complete required fields => A confirmation message must appear, and once confirmed, it must say “Success! Your profile has been successfully updated”
- 2 | Empty required fields => The message must display “Required”
- 3 | Invalid Contact Number format => The message must display “Invalid format (e.g. 9xxxxxxxxx)”
- 4 | File size exceeds 2MB limit => The message must display “Upload Failed. File exceeds the recommended 2mb size”

## 9. ACCOUNT SETTINGS MODULE / CHANGE EMAIL
Preconditions: Login in, click the “My Profile” from the sidebar and click “Change Email”
Action: The email and password must be validated
Verification: The email must be updated
- 1 | Valid Email Address format and correct password => The message must display “Request Link Sent. Verification email sent. Please check your inbox to reactivate your account. You will now be logged out. Please verify your new email before logging in again.”
- 2 | Invalid Email Address format => The message must display “Please enter a valid email address”
- 3 | Valid Email Address format and incorrect password => The message must display “Current password is incorrect”
- 4 | Invalid Email Address format and incorrect password => The message must display “Please enter a valid email address” and “Current password is incorrect”
- 5 | New email is same as the Current Email Address => The message must display “New email must be different from the current email.”

## 10. ACCOUNT SETTINGS MODULE / CHANGE PASSWORD
Preconditions: Login in, click the “Settings” from the sidebar and click “Account Security”
Action: The current password, new password, and confirm new password must be validated
Verification: The password must be updated
- 1 | Correct Current Password, correct New Password format, and New and Confirm New Password Match. => The message must display “Success! Your password has been changed. For your security, you will now be logged out. Please log back with your new password”
- 2 | Empty Required fields => The Update Password button must be disabled
- 3 | Incorrect Current Password => The message must display “Incorrect current password”
- 4 | Incorrect New Password requirements => The password requirements checklist must be unchecked
- 5 | New Password is same as the Current Password => The message must display “New password cannot be the same as the current password”
- 6 | New Password and Confirm New Password do not match => The message must display “Passwords do not match”

## 11. ACCOUNT SETTINGS MODULE / NOTIFICATIONS
Preconditions: Login, click settings from the sidebar and open Notifications
Action: The Notification preferences must be updated
Verification: Enable or disable notification preferences, save the settings, and reopen the page to verify persistence
- 1 | Enable or disable each available notification preference => The message must display “Settings saved successfully”
- 2 | Reopen Notifications => The previously saved notification preferences must load correctly

## 12. USER ACCOUNTS MANAGEMENT MODULE / SEARCH/FILTER STAFF
Preconditions: Login in, click Manage Staffs from the sidebar
Action: Search returns matching staff records for valid input and no results for invalid input
Verification: Verify that all employees matching the search criteria are display in the results
- 1 | Valid search by name or email => The table updates to show only the staff(s) whose name/email matches the search input
- 2 | No match case => The message must display “No results found”
- 3 | Empty search => The table shows records based on the configured rows per page and current page.
- 4 | Filter by available role, lifecycle status, or branch => The table updates to show only the staff/s matching the selected filter/s
- 5 | Change rows per page or navigate to another page => The table shows records based on the configured rows per page and current page

## 13. USER ACCOUNTS MANAGEMENT MODULE / ADD NEW STAFF
Preconditions: Login in, click Manage Staffs from the sidebar then click the Add New *Selected Staff Role Tab* button
Action: The staff’s information must be validated
Verification: The new staff must be added to the staffs list
- 1 | Complete and valid required fields => The message must display “*Selected Staff Role* Added! The account has been created successfully. An activation email has been sent.”
- 2 | Empty required fields => The message must display “Required”
- 3 | Invalid License Number (For Dentists only) => The message must display “Must be 7 digits”
- 4 | Invalid email domain => The message must display “Invalid email domain”
- 5 | Invalid phone number format => The message must display “Invalid format (9xxxxxxxxx)”
- 6 | File size exceeds 2MB limit => The message must display “Upload Failed. File exceeds the recommended 2mb size”

## 14. USER ACCOUNTS MANAGEMENT MODULE / EDIT STAFF INFO
Preconditions: Login in, click Manage Staffs from the sidebar then select a staff from the list and click the edit button
Action: The staff’s information must be validated
Verification: The staff’s information must be updated
- 1 | Complete and valid required fields => The message must display “Success! The *Selected Staff’s Role* profile has been successfully updated.”
- 2 | Empty required fields => The message must display “Required”
- 3 | Invalid License Number (For Dentists only) => The message must display “Must be 7 digits”
- 4 | Invalid email domain => The message must display “Invalid email domain”
- 5 | Invalid phone number format => The message must display “Invalid format (9xxxxxxxxx)”
- 6 | File size exceeds 2MB limit => The message must display “Upload Failed. File exceeds the recommended 2mb size”

## 15. USER ACCOUNTS MANAGEMENT MODULE / STAFF ACCOUNT LIFECYCLE
Preconditions: Login in, click Manage Staffs from the sidebar then select a staff from the list
Action: Activate, deactivate, archive, restore, or reissue staff account access
Verification: The staff’s status must be updated
- 1 | Activate or deactivate selected account => The staff’s account status must be updated successfully after confirmation
- 2 | Archive staff => The staff record must be moved to the archived state
- 3 | Restore archived staff and confirm => The staff record must be restored
- 4 | Reissue activation email to an eligible staff account => The staff activation email must be sent successfully

## 16. USER ACCOUNTS MANAGEMENT MODULE / SEARCH/FILTER PATIENT
Preconditions: Login in, click Manage Patients from the sidebar
Action: Search returns matching patient records for valid input and no results for invalid input
Verification: Verify that all patients matching the search criteria are displayed in the results
- 1 | Valid search by name or email => The table updates to show only the patient(s) whose name/email matches the search input
- 2 | No match case => The message must show “No results found”
- 3 | Empty search => Table shows records based on the configured rows per page and current page
- 4 | Filter by lifecycle status or branch => The table updates to show only the patient/s matching the selected filter/s
- 5 | Change rows per page or navigate to another page => The table shows records based on the configured rows per page and current page

## 17. USER ACCOUNTS MANAGEMENT MODULE / ADD NEW PATIENT
Preconditions: Login in, click Manage Patients from the sidebar then click the Add New Patient button
Action: The patient’s information must be validated
Verification: The new patient must be added to the patients’ list
- 1 | Complete and valid required fields => The message must display “New patient has been successfully added to the system”
- 2 | Empty required fields => The message must display “Required”
- 4 | Invalid email domain => The message must display “Invalid email domain”
- 5 | Invalid mobile number format => The message must display “Invalid format (9xxxxxxxxx)”
- 6 | Invalid home phone number format => The message must display “Invalid landline format”
- 7 | Invalid work phone number format => The message must display “Invalid landline format”
- 8 | File size exceeds 2MB limit => The message must display “Upload Failed. File exceeds the recommended 2mb size”
- 9 | Data and Privacy Consent not acknowledge => The message must display “Data privacy consent has not been acknowledged yet”
- 10 | Dental Consent not acknowledge => The message must display “Consent has not been acknowledged yet”

## 18. USER ACCOUNTS MANAGEMENT MODULE / EDIT PATIENT
Preconditions: Login in, click Manage Patients from the sidebar then select a patient from the list and click the edit button
Action: The patient’s information must be validated
Verification: The patient’s information must be updated
- 1 | Complete and valid required fields => The message must display “Success!
The patient's profile has been successfully updated.”
- 2 | Empty required fields => The message must display “Required”
- 4 | Invalid email domain => The message must display “Invalid email domain”
- 5 | Invalid phone number format => The message must display “Invalid format (9xxxxxxxxx)”
- 6 | Invalid home phone number format => The message must display “Invalid landline format”
- 7 | Invalid work phone number format => The message must display “Invalid landline format”
- 8 | File size exceeds 2MB limit => The message must display “Upload Failed. File exceeds the recommended 2mb size”

## 19. USER ACCOUNTS MANAGEMENT MODULE / PATIENT ACCOUNT LIFECYCLE
Preconditions: Login in, click Manage Patients from the sidebar then select a patient from the list
Action: Activate, deactivate, archive, restore, or send patient access email
Verification: The patient’s account status must be updated
- 1 | Activate or deactivate selected account => The patient’s account status must be updated successfully after confirmation
- 2 | Archive patient => The patient record must be archived without deleting preserved clinical history
- 3 | Restore archived patient and confirm => The patient record must be restored
- 4 | Reissue activation email to an eligible patient account => The patient activation email must be sent successfully

## 20. USER ACCOUNTS MANAGEMENT MODULE / PATIENT BRANCH TRANSFER
Preconditions: Login in, click Manage Patients from the sidebar then select a patient from the list
Action: Transfer patient to another branch
Verification: The patient’s branch assignment must be updated
- 1 | Valid target branch and valid transfer reason => The patient branch assignment must update successfully to the selected target branch
- 2 | Empty target branch => The Confirm Transfer button must be disabled
- 3 | Empty transfer reason => The Confirm Transfer button must be disabled
- 4 | Patient has upcoming appointment => The transfer must be blocked

## 21. BRANCH MANAGEMENT MODULE / ADD BRANCH
Preconditions: Login in, click Branches from the sidebar then click Add Branch button
Action: The new branch information must be validated
Verification: The new branch must be added to the branches’ list
- 1 | Complete and valid required fields => The message must display “Success!
Branch created successfully.”
- 2 | Empty required fields => The message must display “Required”
- 3 | Invalid Contact Number format => The message must display “Invalid contact number”

## 22. BRANCH MANAGEMENT MODULE / EDIT BRANCH
Preconditions: Login in, click Branches from the sidebar then select a branch and click the edit button
Action: The branch information must be validated
Verification: The branch information must be updated
- 1 | Complete and valid required fields => The message must display “Success!
Branch updated successfully.”
- 2 | Empty required fields => The message must display “Required”
- 3 | Invalid Contact Number format => The message must display “Invalid contact number”

## 23. BRANCH MANAGEMENT MODULE / BRANCH STATUS
Preconditions: Login in, click Branches from the sidebar then select a branch
Action: Activate or deactivate a branch
Verification: The branch status must be updated
- 1 | Deactivate an active branch => The branch must be deactivated successfully
- 2 | Activate an inactive branch => The branch must be activated successfully

## 24. BRANCH MANAGEMENT MODULE / BRANCH ANALYTICS
Preconditions: Login in, click Branches from the sidebar then select a branch and click view button
Action: View branch analytics
Verification: The branch analytics must display
- 1 | Selected branch has analytics data => The branch analytics must display
- 2 | Selected branch has no analytics data => The message must display “No status data yet” and “No monthly activity yet”

## 25. SCHEDULE MANAGEMENT MODULE / SEARCH/FILTER SCHEDULE
Preconditions: Login in, click Schedule from the sidebar
Action: Search returns matching schedule records for valid input and no results for invalid input
Verification: Verify that all schedule matching the search criteria are displayed in the results
- 1 | Valid search by name or email => The table updates to show only the schedule(s) that matches the patient, dentist, branch, and procedure search input
- 2 | No match case => The message must show “No results found”
- 3 | Empty search => Table shows records based on the configured rows per page and current page
- 4 | Filter by patient, procedure, dentist, status, branch, type, or date => The table updates to show only the schedule/s matching the selected filter/s
- 5 | Change rows per page or navigate to another page => The table shows records based on the configured rows per page and current page

## 26. SCHEDULE MANAGEMENT MODULE / ADD SCHEDULE
Preconditions: Login in, click Schedule from the sidebar then click Add Schedule Entry button
Action: The schedule information must be valid
Verification: The schedule must be added to the schedule list
- 1 | Complete and valid required fields => The message must display “Success! Appointment created successfully”
- 2 | Empty required fields => The message must display “Required”

## 27. SCHEDULE MANAGEMENT MODULE / EDIT SCHEDULE/RESCHEDULE
Preconditions: Login in, click Schedule from the sidebar then select a schedule entry and click the edit button
Action: The schedule information must be valid
Verification: The schedule must be updated
- 1 | Complete and valid required fields => The message must display “Success! Appointment updated successfully.”
- 2 | Empty required fields => The message must display “Required”

## 28. SCHEDULE MANAGEMENT MODULE / SCHEDULE STATUS MANAGEMENT
Preconditions: Login in, click Schedule from the sidebar then select a schedule from the list
Action: Update appointment status
Verification: The appointment status must be updated
- 1 | Update schedule status to Confirmed => The schedule status must display Confirmed
- 2 | Update schedule status to In Clinic => The schedule status must display In Clinic
- 3 | Update schedule status to Cancel => The schedule status must display Cancelled
- 4 | Complete and valid required fields => The schedule status must display Completed
- 5 | Empty required field => The schedule status must display In Clinic

## 29. PATIENT EMR MODULE / MEDICAL AND DENTAL HISTORY
Preconditions: Login in, click Manage Patients from the side bar then select patient from the list, click View button, and navigate to Medical & Dental History
Action: Update patient’s medical & dental history
Verification: The patient’s medical & dental history must be updated
- 1 | Complete and valid required fields => The medical and dental history must save successfully
- 2 | Empty required fields => The message must display “Required”

## 30. PATIENT EMR MODULE / TREATMENT LOGS
Preconditions: Login in, click Manage Patients from the side bar then select patient from the list, click View button, and navigate to treatment logs
Action: Add or delete treatment logs
Verification: The patient’s treatment log must be updated
- 1 | Complete and valid required fields => The treatment log must be added successfully and appear in the patient EMR
- 2 | Empty required fields => The message must display “Required”
- 3 | Delete treatment log => The treatment log must be removed successfully

## 31. PATIENT EMR MODULE / INTERACTIVE DIGITAL ODONTOGRAM
Preconditions: Login in as Dentist, click Manage Patients from the side bar then select patient from the list, click View button, and navigate to digital odontogram
Action: Manage digital odontogram
Verification: The patient’s digital odontogram must be updated
- 1 | Save a valid supported tooth condition, surface, or stage => The digital odontogram must display the patient’s current tooth data

## 32. PATIENT EMR MODULE / AI-ASSISTED RADIOGRAPH REVIEW
Preconditions: Login as Dentist, click Manage Patients from the sidebar then select patient from the list, click View button, and navigate to Radiograph Images
Action: Upload, review, verify, and manage patient’s radiograph images with AI-assisted review
Verification: Upload radiograph image, review AI-assisted findings, verify dentist actions, and check patient radiograph availability
- 1 | Upload radiograph image under 3MB image-size limit with complete required fields => The radiograph must upload successfully and appear in the patient record
- 2 | Image-size limit exceeds 3MB => The message must display “Image must be under 3MB”
- 3 | Empty required field => The message must display “Required”
- 4 | Generate AI-assisted radiograph review => The AI-assisted review result must display successfully in the radiograph review panel
- 6 | Confirm AI-assisted suggestion => The confirmed finding must be saved successfully in the radiograph review record
- 7 | Correct AI-assisted suggestion => The corrected finding must be updated successfully in the radiograph review record
- 9 | Approve dentist-reviewed radiograph summary => The approved radiograph summary must become available for patient viewing
- 11 | Delete radiograph => The radiograph must be removed successfully

## 33. PATIENT EMR MODULE / PATIENT RADIOGRAPH EXPLANATION
Preconditions: Login as Patient and click Medical Records from the sidebar
Action: View dentist-approved radiograph information and AI explanation
Verification: Open Radiograph Images and verify the available radiograph explanation information
- 1 | Patient has approved radiograph image with dentist findings => The radiograph image and dentist-approved findings must display
- 2 | Patient has approved radiograph explanation => The AI explanation must display based only on dentist-approved findings
- 3 | Patient has pending radiograph review => The radiograph review information must not display
- 4 | Patient has no approved radiograph record => The message must display “No radiographs yet”
- 5 | Patient requests diagnosis from radiograph explanation => The AI must not provide a diagnosis and must recommend consulting the dentist

## 34. INVENTORY MANAGEMENT MODULE / SEARCH/FILTER INVENTORY
Preconditions: Login in, click Inventory from the sidebar
Action: Search/filter returns matching inventory records for valid input and no results for invalid input
Verification: Verify that all inventory matching the search and filter criteria are displayed in the results
- 1 | Valid search or filter by item, category, brand, batch, or branch => Only the inventory records matching the selected search/filter criteria must display
- 2 | No match case => The message must display “No results found”
- 3 | Empty search => The table shows records based on the configured rows per page and current page

## 35. INVENTORY MANAGEMENT MODULE / ADD NEW INVENTORY ITEM
Preconditions: Login in, click Inventory from the sidebar and click Add New Item button
Action: The inventory item information must be validated
Verification: The inventory item must be added to the inventory list
- 1 | Complete and valid required fields => The new inventory item must be created successfully and appear in the inventory tracker
- 2 | Empty required fields => The message must display “Required”

## 36. INVENTORY MANAGEMENT MODULE / ADD INVENTORY STOCK
Preconditions: Login in, click Inventory from the sidebar and choose Add Stock/Receive Stock
Action: The new stock batch information must be validated
Verification: The new stock batch must be added to the batch list
- 1 | Complete and valid required fields => The stock batch must be added successfully and the available stock must update
- 2 | Empty required fields => The message must display “Required”

## 37. INVENTORY MANAGEMENT MODULE / EDIT INVENTORY ITEM
Preconditions: Login in, click Inventory from the sidebar and click the edit button
Action: The inventory item information must be validated
Verification: The inventory item information must be updated
- 1 | Complete and valid required fields => The inventory item must be updated successfully
- 2 | Empty required fields => The message must display “Required”

## 38. INVENTORY MANAGEMENT MODULE / DELETE STOCK BATCH
Preconditions: Login in, click Inventory from the sidebar, select a stock and click the delete button
Action: Delete a selected inventory stock batch
Verification: The inventory stock batch must be removed
- 1 | Selected a batch and deletion is confirmed => The message must display “Stock batch deleted successfully” and the selected batch must be removed
- 2 | Selected a batch and deletion is cancelled => The stock batch must remain in the inventory

## 39. INVENTORY MANAGEMENT MODULE / MATERIAL USAGE LOG
Preconditions: Login in, click Material Usage Log from the side bar then click Log New Entry button
Action: Log materials used for a completed appointment
Verification: The logged materials must be added to the list
- 1 | Complete and valid required fields => The material usage log must save successfully and the corresponding inventory quantities must decrease
- 2 | Empty required fields => The message must display “Required”

## 40. SYSTEM CONFIGURATION MODULE / UPDATE SYSTEM CONFIGURATION
Preconditions: Login in, click System Configuration from the side bar
Action: Validate and save global system configuration settings
Verification: The system configuration settings must be updated
- 1 | Complete and valid required fields => The system configuration must save successfully
- 2 | Empty required fields => The message must display “Required”

## 41. SYSTEM CONFIGURATION MODULE / WEBSITE CONTENT AND MEDIA
Preconditions: Login, click System Configuration from the sidebar then navigate to Website Content
Action: The website content and media must be validated
Verification: Update the website content or media, save the changes, and verify the updated information
- 1 | Complete and valid website content => The message must display “System configuration saved successfully”
- 2 | Upload valid Website Logo with Text image file under 20MB => The message must display “Website Logo with Text uploaded successfully. Save Changes to publish it on website”
- 3 | Upload Website Logo with Text image file that exceeds 20MB => The message must display “Image exceeds 20 MB”
- 4 | Save website content and reopen System Configuration => The previously saved website content and media must load correctly

## 42. ARCHIVE REVIEW MODULE / SEARCH/FILTER ARCHIVE RECORDS
Preconditions: Login in, click Archive Review from the sidebar
Action: Search/filter returns matching archived records for valid input and no results for invalid input
Verification: Verify that all archived records matching the search and filter criteria are displayed in the results
- 1 | Valid search or filter by name, email, role, archive reason, or review state => Only the archived records matching the selected search/filter criteria must display
- 2 | No match case => The message must display “No results found”
- 3 | Empty search => The table shows records based on the configured rows per page and current page

## 43. ARCHIVE REVIEW MODULE / RESTORE/PERMANENT DELETE REVIEW
Preconditions: Login in, click Archive Review from the sidebar and archived records must exist
Action: Restore or permanently delete an archived record
Verification: The archived record’s state must be restored/deleted
- 1 | Restore and confirm an archived record => The record must be restored
- 2 | Permanently delete an archived record => The record must be permanently deleted

## 44. DATABASE BACKUP MODULE / BACKUP STATUS AND HISTORY
Preconditions: Login, click Database Backup from the sidebar
Action: View the database backup status and history
Verification: Verify the backup status, history, file availability, and verification result
- 1 | Existing backup records => The backup history must display the existing backup records with their corresponding status, file availability, and verification result
- 2 | No existing backup => The message must display “No backups have been created yet. Click Create Backup Now to create the first database backup file”
- 3 | Click Refresh => The message must display “Backup information refreshed successfully”

## 45. DATABASE BACKUP MODULE / CREATE DATABASE BACKUP
Preconditions: Login in, click Database Backup from the sidebar and click Create Backup Now button
Action: Create a manual database backup
Verification: Verify the progress/result and backup history
- 1 | Backup tools available and no backup currently running => The backup must be created successfully and appear in the backup history
- 2 | Another backup is already running => The in-progress must display and duplicate backup must be prevented

## 46. DATABASE BACKUP MODULE / AUTOMATIC BACKUP SETTINGS
Preconditions: Login, click Database Backup from the sidebar and navigate to Automatic Backup Settings
Action: The automatic backup settings must be validated
Verification: Enable or disable automatic backup, update the schedule settings, save, and verify persistence
- 1 | Enable automatic backups, Backup frequency = 24 hours, Number of completed backups to keep = 14 => The message must display “Backup settings saved successfully”
- 2 | Disable automatic backups => The message must display “Backup settings saved successfully”
- 3 | Backup frequency below 1 or above 168 hours => The save backup frequency must remain within the allowed range of 1 to 168 hours
- 4 | Number of completed backups to keep below 0 or above 90 => The save retention value must remain within the allowed range of 0 to 90
- 5 | Save automatic backup settings and reopen Database Backup => The previously save automatic backup settings must load correctly

## 47. DATABASE BACKUP MODULE / DOWNLOAD AND VERIFY BACKUP
Preconditions: Login, click Database Backup from the sidebar and a completed backup record must exist
Action: Download or verify the selected database backup
Verification: Select an available backup, download or verify it, and check the result
- 1 | Select a completed backup with available file and click Download => The selected backup file must be downloaded
- 2 | Select a completed backup with available file and click Verify Restore => The verification status must display “Restore verified”

## 48. INTEGRITY TOOLS MODULE / RUN INTEGRITY CHECKS
Preconditions: Login, click Integrity Tools from the sidebar
Action: Run all or selected system integrity checks
Verification: Run the integrity checks and verify the status and affected records
- 1 | Run integrity checks with no detected issues => The corresponding integrity checks must display “Pass” and “No issues”
- 2 | Run integrity check with warning-level issue => The corresponding integrity check must display “Warning” and the affected record/s
- 3 | Run integrity check with failed issue => The corresponding integrity check must display “Failed” and the affected record/s
- 4 | Run an individual integrity check => The selected integrity check result must display
- 5 | Network unavailable while running all integrity checks => The message must display “Network error running integrity checks”

## 49. INTEGRITY TOOLS MODULE / SAFE AUTO-FIX
Preconditions: Login, click Integrity Tools from the sidebar and an integrity issue eligible for Safe Auto-Fix must exist
Action: Apply Safe Auto-Fix to the selected eligible integrity issue
Verification: Confirm the Safe Auto-Fix and verify that the affected record/s are updated
- 1 | Select an issue marked Safe Auto-Fix and confirm => The eligible record/s must be updated and the integrity check must run again
- 2 | Select an issue marked Safe Auto-Fix and cancel => The affected record/s must remain unchanged
- 3 | Select an issue marked Manual Review => The Auto-Fix action must not be available
- 4 | Safe Auto-Fix completed successfully => The message must display “Integrity issue fixed successfully”

## 50. ACTIVITY LOGS MODULE / SEARCH/FILTER ACTIVITY LOGS
Preconditions: Login in, click Activity Logs from the sidebar
Action: Search returns matching activity logs records for valid input and no results for valid input
Verification: Verify that all activity logs matching the search criteria are displayed in the results
- 1 | Valid search by action, detail, or category => Table updates to show only the activity logs if action, detail, or category matches the search input
- 2 | No match action, detail, or category => The message must display “No results found”
- 3 | Empty search => The table shows records based on the configured rows per page and current page.

## 51. ACTIVITY LOGS MODULE / VIEW ACTIVITY DETAILS
Preconditions: Login, click Activity Logs from the sidebar and activity log records must exist
Action: View the selected activity log details
Verification: Select an activity log and verify the complete recorded details
- 1 | Select an existing activity log and click View Details => The “Activity Log Details” modal must display the Date, Time, Action, Category, and Recorded Details
- 2 | Close the Activity Log Details modal => The Activity Logs list must display

## 52. SYSTEM AUDIT LOGS MODULE / SEARCH/FILTER SYSTEM AUDIT LOGS
Preconditions: Login in, click System Audit Logs from the sidebar
Action: Search returns matching system audit logs records for valid input and no results for valid input
Verification: Verify that all system audit logs matching the search criteria are displayed in the results
- 1 | Valid search by action, detail, or category => Table updates to show only the system audit logs if action, user, role, detail, or category matches the search input
- 2 | No match action, detail, or category => The message must display “No results found”
- 3 | Empty search => The table shows records based on the configured rows per page and current page.

## 53. SYSTEM AUDIT LOGS MODULE / VIEW AUDIT DETAILS
Preconditions: Login, click System Audit Logs from the sidebar and system audit log records must exist
Action: View the selected system audit log details
Verification: Select a system audit log and verify the complete recorded details
- 1 | Select an existing system audit log and click View Details => The “Audit Log Details” modal must display the Date, Time, User, Action, and Recorded Details
- 2 | Close the Audit Log Details modal => The System Audit Logs list must display

## 54. AI PATIENT ENGAGEMENT MODULE / NGITIBOT CHAT
Preconditions: Login as Patient and open NgitiBot
Action: Send a message or select a suggested prompt in NgitiBot
Verification: Verify that patient messages and NgitiBot explanations display in the conversation
- 1 | Enter a supported Dental Health Education question and click Send => The patient message and NgitiBot educational explanation must display in the conversation
- 2 | Select “Explain my current visit recommendation” => NgitiBot must explain the existing System Recommendation without replacing or overriding it
- 3 | Select “Explain my recent Oral Health Management trend” => NgitiBot must explain the available Oral Health Management information without providing a diagnosis
- 4 | Select “Explain my radiograph findings” with an approved dentist finding available => NgitiBot must explain the dentist-approved radiograph findings
- 5 | Select “Explain my radiograph findings” without approved dentist findings => NgitiBot must display that no approved radiograph explanation is available
- 6 | Enter a request for dental diagnosis => NgitiBot must not provide a diagnosis and must recommend consulting the dentist
- 7 | Enter unsupported question => The message must display “I can only assist with NgitiFy dental health information and available patient records.”
- 8 | Empty message field => The Send button must be disabled
- 9 | Existing conversation and click Clear => The conversation must reset to the initial AI welcome message

## 55. AI PATIENT CARE COMPANION MODULE / NGITIBOT CARE CONTEXT
Preconditions: Login as Patient, open the AI Care Companion and patient care information must be available
Action: View the patient’s existing care context and System Recommendation
Verification: Verify the Recommended Visit Window, Oral Health Management information, and Dental Health Education context
- 1 | Existing System Recommendation => The Recommended Visit Window, recommendation reason, and System Recommendation must display
- 2 | Existing Daily Oral Health Log => The recent Oral Health Management context and latest saved log must display
- 3 | No recent Daily Oral Health Log => The message must display “No recent Daily Oral Health Log is available yet”
- 4 | No supported clinic information for a visit window => The recommendation must display “Insufficient Data” and the message must display “NgitiFy does not have enough clinic information to create a visit window”
- 5 | No contextual Dental Health Education for recent logs => The message must display “No contextual Dental Health Education topics are currently matched to your recent logs”
- 6 | Existing dentist-approved radiograph finding => The radiograph explanation context must display
- 7 | No approved radiograph findings => The message must display that no radiograph explanation is currently available

## 56. PATIENT APPOINTMENTS MODULE / MY APPOINTMENTS
Preconditions: Login as Patient and click My Appointments from the sidebar
Action: View patient’s upcoming and previous appointments
Verification: Verify that the patient’s appointment records and details are displayed
- 1 | Patient has upcoming appointment => The upcoming appointment must display
- 2 | Patient has completed or cancelled appointment => The appointment must display in the appointment history
- 3 | Patient has no upcoming appointment => The message must display “No upcoming appointment”
- 4 | Select an existing appointment => The selected appointment details must display
- 5 | Patient has no completed or cancelled appointment => The message must display “No visit history yet”

## 57. PATIENT APPOINTMENTS MODULE / BOOK APPOINTMENT
Preconditions: Login as Patient, click My Appointments from the sidebar then click Book Appointment
Action: The appointment information must be validated
Verification: The new appointment must be added to My Appointments
- 1 | Complete and valid required fields, the patient has no ongoing appointment, and selected date and time are available => The appointment must be submitted successfully and appear in My Appointments
- 2 | Patient has an existing ongoing appointment => The patient must not be able to book another appointment
- 3 | Patient’s previous appointment has Completed or Cancelled status => The patient must be able to book a new appointment
- 4 | Select a fully booked appointment date => The fully booked date must not be available for selection
- 5 | Select an appointment time already booked by another patient => The booked appointment time must not be available for selection
- 6 | Select an available appointment date and time => The selected appointment date and time must be available for booking

## 58. PATIENT APPOINTMENTS MODULE / MANAGE APPOINTMENT
Preconditions: Login as Patient, click My Appointments from the sidebar then select an upcoming appointment
Action: Cancel or reschedule the selected appointment based on the allowed appointment conditions
Verification: The selected appointment must be cancelled or rescheduled without creating another appointment
- 1 | Cancel an eligible Pending or Confirmed appointment with valid cancellation reason => The appointment status must display Cancelled
- 2 | Cancel an eligible appointment with empty cancellation reason => The appointment must not be cancelled
- 3 | Reschedule an eligible Pending or Confirmed appointment to an available date and time => The existing appointment must be updated with the new schedule and another appointment record must not be created
- 6 | Cancel or reschedule an In Clinic appointment => The cancel and reschedule actions must not be available
- 7 | Cancel or reschedule a Completed appointment => The cancel and reschedule actions must not be available

## 59. ORAL HEALTH MANAGEMENT MODULE / DAILY ORAL HEALTH LOG
Preconditions: Login as Patient, click Oral Health Management from the sidebar and select today or a previous date
Action: The Daily Oral Health Log information must be validated
Verification: Select the oral health information, save the entry, and verify the saved Daily Oral Health Log
- 1 | Select any valid symptom, oral care habit, or other factor and click Save Entry => The message must display “Daily oral health log saved”
- 2 | Empty symptom, oral care, other factor, and notes => The message must display “Select at least one symptom, care item, risk factor, or note before saving”
- 3 | Select “No Symptoms” then select another symptom => “No Symptoms” and another symptom must not remain selected at the same time
- 4 | Select Toothache, Swelling, Jaw Pain, or Mouth Sore and enter optional Severity or Duration => The message must display “Daily oral health log saved”
- 5 | Enter a valid optional note => The message must display “Daily oral health log saved”

## 60. ORAL HEALTH MANAGEMENT MODULE / ORAL HEALTH CALENDAR & HISTORY
Preconditions: Login as Patient, click Oral Health Management from the sidebar and open Calendar
Action: View the patient’s Oral Health Management records by selected date
Verification: Select different calendar dates and verify the corresponding Oral Health Management information
- 1 | Select a date with an existing Daily Oral Health Log => The selected Daily Oral Health Log must display and the selected date must display “Patient Log”
- 2 | Select a date without a Patient Log, appointment, clinic record, or recommendation => The message must display “No information on this date” and “Select another date or save a log for this day”
- 3 | No saved Daily Oral Health Log history => The message must display “No history yet” and “Saved entries will appear here and mark the calendar”
- 4 | Select another date using the week selector or month calendar => The Oral Health Management information must update based on the selected date
- 5 | Date contains a saved Daily Oral Health Log => The corresponding Daily Log marker must display on the selected date

## 61. ORAL HEALTH MANAGEMENT MODULE / ORAL HEALTH TRENDS
Preconditions: Login as Patient, click Oral Health Management from the sidebar and open Trends
Action: View the patient’s Oral Health Management trends from saved Patient Logs
Verification: Verify the calculated 7-day and 30-day trend information
- 1 | At least three Daily Oral Health Logs within the last 30 days => The 7-day and 30-day Oral Health Management trend counts must display
- 2 | No Daily Oral Health Logs within the last 30 days => The message must display “Insufficient history for trends”
- 3 | One Daily Oral Health Log within the last 30 days => The message must display “Insufficient history for trends”
- 4 | At least three logs but no symptoms within the last 30 days => The message must display “No symptoms recorded in the last 30 days”
- 5 | At least three logs but no other risk factors within the last 30 days => The message must display “No other risk factors recorded in the last 30 days”

## 62. ORAL HEALTH MANAGEMENT MODULE / RECOMMENDED VISIT WINDOW
Preconditions: Login as Patient, click Oral Health Management from the sidebar and Recommended Visit Window information must be available
Action: Display the patient’s Recommended Visit Window based on the available clinic information and Oral Health Management rules
Verification: Verify the recommendation, source, reason, and visit timing
- 1 | Dentist Suggested Next Visit exists and no earlier-contact rule applies => The Dentist Recommendation must remain the primary planned-care recommendation
- 2 | Latest Daily Oral Health Log contains Swelling => The recommendation must display Contact Clinic guidance without providing a diagnosis
- 3 | Latest supported symptom detail has Severe severity => The recommendation must display Contact Clinic guidance without providing a diagnosis
- 4 | No Dentist Suggested Next Visit and insufficient supported clinic treatment history => The recommendation must display “Insufficient Data” and an unsupported visit window must not be created

## 63. DENTAL HEALTH EDUCATION MODULE / CONTEXTUAL DENTAL HEALTH EDUCATION
Preconditions: Login as Patient, click Oral Health Management from the sidebar and a Daily Oral Health Log must be available
Action: Display Dental Health Education related to the recorded Oral Health Management information
Verification: Select a date with recorded information and verify the corresponding Dental Health Education topic/s
- 1 | Daily Oral Health Log contains Sensitivity => “Understanding tooth sensitivity” must display
- 2 | Daily Oral Health Log contains Bleeding Gums => Related Gum Care and Flossing Dental Health Education must display
- 3 | Daily Oral Health Log contains Missed Brushing => “Build a brushing routine you can repeat” must display
- 4 | Daily Oral Health Log contains Sugary Drinks => “Sugary drinks and everyday oral care” must display
- 5 | Daily Oral Health Log contains Smoked or Vaped => “Smoking, vaping, and oral-health conversations” must display
- 6 | Selected date has no information matching a Dental Health Education topic => The message must display “No education topics found”

## 64. DENTAL HEALTH EDUCATION MODULE / DENTAL HEALTH EDUCATION LIBRARY
Preconditions: Login as Patient, click Oral Health Management from the sidebar then open Dental Health Education
Action: Search, filter, and view the Dental Health Education library
Verification: Select a category, enter a search keyword, and open an available article
- 1 | Open Dental Health Education => The available Dental Health Education articles and categories must display
- 2 | Select an available Dental Health Education category => Only the Dental Health Education articles matching the selected category must display
- 3 | Enter a valid Dental Health Education search keyword => The matching Dental Health Education article/s must display
- 4 | Enter a search keyword with no matching article => no matching article
The message must display “No education topics found”
- 5 | Select an existing Dental Health Education article => The selected article title, summary, content, and “What you can do” information must display

## 65. PATIENT NOTIFICATIONS MODULE / NOTIFICATION INBOX
Preconditions: Login as Patient and click Notifications from the sidebar
Action: View and manage the patient’s notifications
Verification: Open Notifications, select unread notifications, and verify the notification status and unread count
- 1 | Patient has read and unread notifications => The notification list, unread count, and total notification count must display correctly
- 2 | Select an unread notification => The selected notification must be marked as read
- 3 | Click Mark All as Read => All unread notifications must be marked as read and the inbox must display “All caught up”

## 66. MY EMR MODULE / VIEW EMR
Preconditions: Login as Patient and click Medical Records from the sidebar
Action: View the patient’s available EMR information
Verification: Navigate through Overview, Medical & Dental History, Treatment History, Odontogram, and X-Rays and verify the available records
- 1 | Patient has an Overview => The Overview must display
- 2 | Patient has Medical & Dental History => The Medical & Dental History must display
- 3 | Patient has existing treatment records => The Recent Treatment History must display
- 4 | Patient has no treatment history => The message must display “No treatment history yet”
- 5 | Patient has an existing odontogram => The patient’s odontogram must display and the patient must not be able to edit it
- 6 | Patient has no odontogram record => The message must display “No odontogram recorded yet”
- 7 | Patient has existing radiograph record/s => The available radiograph record/s must display
- 8 | Patient has no radiograph records => The message must display “No radiographs yet” and “Radiographs uploaded by the clinic will appear here for your reference”
# MOBILE

## 1. LOGIN MODULE / LOGIN
Preconditions: Launch the NgitiFy mobile app; an active patient account exists
Action: The email and password must be validated
Verification: The dashboard must display
- 1 | Correct email and password => The dashboard must display
- 2 | Correct email and incorrect password => The message must display “Invalid email or password”
- 3 | Incorrect email and correct password => The message must display “Invalid email or password”
- 4 | Incorrect email and password => The message must display "Invalid email and password"
- 5 | Empty email and password => The message must display “Email address is required” and “Password is required”
- 6 | Too many failed login attempts => The message must display “Too many login attempts. Please try again in 15 minutes.”

## 2. LOGIN MODULE / FORGOT PASSWORD
Preconditions: Launch the NgitiFy mobile app, open the Login screen, and tap the Forgot Password link
Action: The email must be validated
Verification: The verification methods page must display
- 1 | Enter email address => The verification code page must display
- 2 | Empty email address field => The Send Verification Code button must be disabled

## 3. LOGIN MODULE / FORGOT PASSWORD - OTP
Preconditions: On the Forgot Password screen, enter the registered patient email address and request a verification code
Action: The OTP must be validated
Verification: The reset password page must display
- 1 | Correct OTP => The reset password page must display
- 2 | Incorrect OTP => The message must display “Invalid or expired OTP”
- 3 | Resend OTP => The resend countdown must restart

## 4. LOGIN MODULE / RESET PASSWORD
Preconditions: On the OTP verification step, enter a valid OTP to continue to the new-password form
Action: The new and confirm new password must be validated
Verification: The password must be reset and the login page must display
- 1 | New and confirm new password matched => The Successful Password Change page must display
- 2 | Invalid new password format => The Reset Password button must be disabled
- 3 | New and confirm new password do not match => The message must display “Passwords do not match”
- 4 | Empty new password and confirm new password => The enter button must be disabled

## 5. ACCOUNT SETTINGS MODULE / EDIT PROFILE
Preconditions: Login as a patient, tap Profile on the bottom navigation bar, and select Edit profile
Action: The user details must be validated
Verification: The user details must be updated
- 1 | Complete required fields => A confirmation message must appear, and once confirmed, it must say “Profile Updated. Your profile information has been successfully saved”
- 2 | Empty required fields => The message must display “Required”
- 3 | Invalid Contact Number format => The message must display “Invalid format (e.g. 9xxxxxxxxx)”

## 6. ACCOUNT SETTINGS MODULE / CHANGE EMAIL
Preconditions: Login as a patient, tap Profile on the bottom navigation bar, and select Change Email
Action: The email and password must be validated
Verification: The email must be updated
- 1 | Valid Email Address format and correct password => The message must display “Request Link Sent. Verification email sent. Please check your inbox to reactivate your account. You will now be logged out. Please verify your new email before logging in again.”
- 2 | Invalid Email Address format => The message must display “Please enter a valid email address”
- 3 | Valid Email Address format and incorrect password => The message must display “Incorrect current password”
- 4 | Invalid Email Address format and incorrect password => The message must display “Please enter a valid email address” and “Incorrect current password”
- 5 | New email is same as the Current Email Address => The message must display “New email must be different from the current email.”

## 7. ACCOUNT SETTINGS MODULE / CHANGE PASSWORD
Preconditions: Login as a patient, tap Profile on the bottom navigation bar, open Settings, and select Change Password
Action: The current password, new password, and confirm new password must be validated
Verification: The password must be updated
- 1 | Correct Current Password, correct New Password format, and New and Confirm New Password Match. => The message must display “Password changed. You will be logged out for security”
- 2 | Empty Required fields => The message must display “Current password is required”
- 3 | Incorrect Current Password => The message must display “Incorrect password”
- 4 | Incorrect New Password requirements => The password requirements checklist must be unchecked
- 5 | New Password is same as the Current Password => The message must display “New password cannot be the same as the current password”
- 6 | New Password and Confirm New Password do not match => The message must display “Passwords do not match”

## 8. ACCOUNT SETTINGS MODULE / NOTIFICATIONS
Preconditions: Login as a patient, tap Profile on the bottom navigation bar, open Settings, and scroll to the Notifications section
Action: The Notification preferences must be updated
Verification: Enable or disable notification preferences, save the settings, and reopen the page to verify persistence
- 1 | Enable or disable each available notification preference => The settings must be saved successfully
- 2 | Reopen Notifications => The previously saved notification preferences must load correctly

## 9. AI PATIENT ENGAGEMENT MODULE / NGITIBOT CHAT
Preconditions: Login as a patient and tap the floating NgitiBot button
Action: Send a message or select a suggested prompt in NgitiBot
Verification: Verify that patient messages and NgitiBot explanations display in the conversation
- 1 | Enter a supported Dental Health Education question and click Send => The patient message and NgitiBot educational explanation must display in the conversation
- 2 | Select “Explain my current visit recommendation” => NgitiBot must explain the existing System Recommendation without replacing or overriding it
- 3 | Select “Explain my recent Oral Health Management trend” => NgitiBot must explain the available Oral Health Management information without providing a diagnosis
- 4 | Select “Explain my radiograph findings” with an approved dentist finding available => NgitiBot must explain the dentist-approved radiograph findings
- 5 | Select “Explain my radiograph findings” without approved dentist findings => NgitiBot must display that no approved radiograph explanation is available
- 6 | Enter a request for dental diagnosis => NgitiBot must not provide a diagnosis and must recommend consulting the dentist
- 7 | Enter unsupported question => The message must display “I am here as your Dentime AI patient care companion, so I can only assist you with dental health topics, oral care guidance, and your clinic appointments”
- 8 | Empty message field => The Send button must be disabled
- 9 | Existing conversation and click Clear => The conversation must reset to the initial AI welcome message

## 10. AI PATIENT CARE COMPANION MODULE / NGITIBOT CARE CONTEXT
Preconditions: Login as a patient, tap the floating NgitiBot button, and ensure patient care information is available
Action: View the patient’s existing care context and System Recommendation
Verification: Verify the Recommended Visit Window, Oral Health Management information, and Dental Health Education context
- 1 | Existing System Recommendation => The Recommended Visit Window, recommendation reason, and System Recommendation must display
- 2 | Existing Daily Oral Health Log => The recent Oral Health Management context and latest saved log must display
- 3 | No recent Daily Oral Health Log => The message must display “Nothing logged yet”
- 4 | No supported clinic information for a visit window => The recommendation must display “No visit window is available yet”
- 5 | Existing dentist-approved radiograph finding => The radiograph explanation context must display
- 8 | No approved radiograph findings => The message must display that no radiograph explanation is currently available

## 11. PATIENT APPOINTMENTS MODULE / MY APPOINTMENTS
Preconditions: Login as a patient and tap Visits on the bottom navigation bar
Action: View patient’s upcoming and previous appointments
Verification: Verify that the patient’s appointment records and details are displayed
- 1 | Patient has upcoming appointment => The upcoming appointment must display
- 2 | Patient has completed or cancelled appointment => The appointment must display in the appointment history
- 3 | Patient has no upcoming appointment => The message must display “No upcoming appointment”
- 4 | Patient has no completed or cancelled appointment => The message must display “No visit history yet”

## 12. PATIENT APPOINTMENTS MODULE / BOOK APPOINTMENT
Preconditions: Login as a patient, tap Visits on the bottom navigation bar, and tap Book Appointment
Action: The appointment information must be validated
Verification: The new appointment must be added to My Appointments
- 1 | Complete and valid required fields, the patient has no ongoing appointment, and selected date and time are available => The appointment must be submitted successfully and appear in My Appointments
- 2 | Patient has an existing ongoing appointment => The patient must not be able to book another appointment
- 3 | Patient’s previous appointment has Completed or Cancelled status => The patient must be able to book a new appointment
- 4 | Select a fully booked appointment date => The fully booked date must not be available for selection
- 5 | Select an appointment time already booked by another patient => The booked appointment time must not be available for selection
- 6 | Select an available appointment date and time => The selected appointment date and time must be available for booking

## 13. PATIENT APPOINTMENTS MODULE / MANAGE APPOINTMENT
Preconditions: Login as Patient, tap Visits on the bottom navigation bar, then select an upcoming appointment
Action: Cancel or reschedule the selected appointment based on the allowed appointment conditions
Verification: The selected appointment must be cancelled or rescheduled without creating another appointment
- 1 | Cancel an eligible Pending or Confirmed appointment with valid cancellation reason => The appointment status must display Cancelled
- 2 | Cancel an eligible appointment with empty cancellation reason => The appointment must not be cancelled
- 3 | Reschedule an eligible Pending or Confirmed appointment to an available date and time => The existing appointment must be updated with the new schedule and another appointment record must not be created
- 6 | Cancel or reschedule an In Clinic appointment => The cancel and reschedule actions must not be available
- 7 | Cancel or reschedule a Completed appointment => The cancel and reschedule actions must not be available

## 14. ORAL HEALTH MANAGEMENT MODULE / DAILY ORAL HEALTH LOG
Preconditions: Login as a patient, tap Health on the bottom navigation bar, open Today, and select today or an earlier date
Action: The Daily Oral Health Log information must be validated
Verification: Select the oral health information, save the entry, and verify the saved Daily Oral Health Log
- 1 | Select any valid symptom, oral care habit, or other factor and click Save Entry => The message must display “Daily oral health log saved”
- 2 | Empty symptom, oral care, other factor, and notes => The message must display “Select at least one symptom, care item, risk factor, or note before saving”
- 3 | Select “No Symptoms” then select another symptom => “No Symptoms” and another symptom must not remain selected at the same time
- 4 | Select Toothache, Swelling, Jaw Pain, or Mouth Sore and enter optional Severity or Duration => The message must display “Daily oral health log saved”
- 5 | Enter a valid optional note => The message must display “Daily oral health log saved”

## 15. ORAL HEALTH MANAGEMENT MODULE / ORAL HEALTH CALENDAR & HISTORY
Preconditions: Login as a patient, tap Health on the bottom navigation bar, and open Calendar
Action: View the patient’s Oral Health Management records by selected date
Verification: Select different calendar dates and verify the corresponding Oral Health Management information
- 1 | Select a date with an existing Daily Oral Health Log => The selected Daily Oral Health Log must display and the selected date must display “Patient Log”
- 2 | Select a date without a Patient Log, appointment, clinic record, or recommendation => The message must display “Nothing logged yet”
- 3 | No saved Daily Oral Health Log history => The message must display “Not enough information yet”
- 4 | Select another date using the week selector or month calendar => The Oral Health Management information must update based on the selected date
- 5 | Date contains a saved Daily Oral Health Log => The corresponding Daily Log marker must display on the selected date

## 16. ORAL HEALTH MANAGEMENT MODULE / ORAL HEALTH TRENDS
Preconditions: Login as a patient, tap Health on the bottom navigation bar, and open Trends
Action: View the patient’s Oral Health Management trends from saved Patient Logs
Verification: Verify the calculated 7-day and 30-day trend information
- 1 | At least two Daily Oral Health Logs within the last 30 days => The 7-day and 30-day Oral Health Management trend counts must display
- 2 | No Daily Oral Health Logs within the last 30 days => The message must display “Not enough information yet”
- 3 | One Daily Oral Health Log within the last 30 days => The message must display “Not enough information yet”
- 4 | At least three logs but no symptoms within the last 30 days => The message must display “No symptoms were recorded in this period”
- 5 | At least three logs but no other risk factors within the last 30 days => The message must display “No risk factors were recorded in this period”

## 17. ORAL HEALTH MANAGEMENT MODULE / RECOMMENDED VISIT WINDOW
Preconditions: Login as a patient, tap Health on the bottom navigation bar, and ensure the Recommended Visit Window section is available
Action: Display the patient’s Recommended Visit Window based on the available clinic information and Oral Health Management rules
Verification: Verify the recommendation, source, reason, and visit timing
- 1 | Dentist Suggested Next Visit exists and no earlier-contact rule applies => The Dentist Recommendation must remain the primary planned-care recommendation
- 2 | Latest Daily Oral Health Log contains Swelling => The recommendation must display Contact Clinic guidance without providing a diagnosis
- 3 | Latest supported symptom detail has Severe severity => The recommendation must display Contact Clinic guidance without providing a diagnosis
- 4 | No Dentist Suggested Next Visit and insufficient supported clinic treatment history => The recommendation must display “No visit window is available yet”

## 18. DENTAL HEALTH EDUCATION MODULE / CONTEXTUAL DENTAL HEALTH EDUCATION
Preconditions: Login as Patient, tap Health on the bottom navigation bar and a Daily Oral Health Log must be available
Action: Display Dental Health Education related to the recorded Oral Health Management information
Verification: Select a date with recorded information and verify the corresponding Dental Health Education topic/s
- 1 | Daily Oral Health Log contains Sensitivity => “Understanding tooth sensitivity” must display
- 2 | Daily Oral Health Log contains Bleeding Gums => Related Gum Care and Flossing Dental Health Education must display
- 3 | Daily Oral Health Log contains Missed Brushing => “Build a brushing routine you can repeat” must display
- 4 | Daily Oral Health Log contains Sugary Drinks => “Sugary drinks and everyday oral care” must display
- 5 | Daily Oral Health Log contains Smoked or Vaped => “Smoking, vaping, and oral-health conversations” must display
- 6 | Selected date has no information matching a Dental Health Education topic => The message must display “No matching topic yet”

## 19. DENTAL HEALTH EDUCATION MODULE / DENTAL HEALTH EDUCATION LIBRARY
Preconditions: Login as a patient, tap Health on the bottom navigation bar, and open Dental Health Education
Action: Search, filter, and view the Dental Health Education library
Verification: Select a category, enter a search keyword, and open an available article
- 1 | Open Dental Health Education => The available Dental Health Education articles and categories must display
- 2 | Select an available Dental Health Education category => Only the Dental Health Education articles matching the selected category must display
- 3 | Enter a valid Dental Health Education search keyword => The matching Dental Health Education article/s must display
- 4 | Enter a search keyword with no matching article => no matching article
The message must display “No education topics found” and “Try another category or clear your search to browse the full Dental Health Education library”
- 5 | Select an existing Dental Health Education article => The selected article title, summary, content, and “What you can do” information must display

## 20. PATIENT NOTIFICATIONS MODULE / NOTIFICATION INBOX
Preconditions: Login as a patient, tap the notification bell on Home, and open Notifications
Action: View and manage the patient’s notifications
Verification: Open Notifications, select unread notifications, and verify the notification status and unread count
- 1 | Patient has read and unread notifications => The notification list, unread count, and total notification count must display correctly
- 2 | Select an unread notification => The selected notification must be marked as read
- 3 | Click Mark All as Read => All unread notifications must be marked as read and the inbox must display “All caught up”

## 21. PATIENT MEDICAL RECORDS MODULE / VIEW EMR
Preconditions: Login as a patient and tap Records on the bottom navigation bar
Action: View the patient’s available EMR information
Verification: Navigate through Overview, Medical & Dental History, Treatment History, Odontogram, and X-Rays and verify the available records
- 1 | Patient has Medical & Dental History => The Medical & Dental History must display
- 2 | Patient has existing treatment records => The Recent Treatment History must display
- 3 | Patient has no treatment history => The message must display “No treatment history yet”
- 4 | Patient has an existing odontogram => The patient’s odontogram must display and the patient must not be able to edit it
- 5 | Patient has no odontogram record => The message must display “No odontogram updates have been recorded yet”
- 6 | Patient has existing radiograph record/s => The available radiograph record/s must display
- 7 | Patient has no radiograph records => The message must display “No radiograph images on file”