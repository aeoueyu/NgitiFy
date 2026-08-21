# Patient Profile Permissions

Patient registration and clinic staff workflows own clinical record creation and correction. Patient profile editing is limited to non-clinical account and demographic information.

| Concept | Web before | Mobile before | Final patient self-edit behavior |
| --- | --- | --- | --- |
| Identity | Name, birthdate, gender | Name, birthdate, gender | Editable on both |
| Contact | Mobile, home phone, work phone | Mobile | Mobile, home phone, and work phone editable on both |
| Demographics | Occupation, civil status, nationality, religion | Occupation, civil status | All four editable on both |
| Contacts | Emergency contact and guardian | Emergency contact | Emergency contact and guardian editable on both |
| Address and photo | Home address and profile image | Home address and profile image | Editable on both |
| Medical and dental history | Editable intake-style form | Blood type, allergies, conditions, medications | Removed from both profile editors; read-only in Records |

The backend allowlist is the enforcement boundary. For a patient using `PUT /api/user/update-profile/:id`, the only accepted top-level keys are `name`, `contactNumber`, `birthdate`, `gender`, `homePhone`, `workPhone`, `occupation`, `civilStatus`, `nationality`, `religion`, `emergencyContact`, `guardian`, `homeAddress`, `currentAddress`, `permanentAddress`, and `profileImage`. Nested name, contact, guardian, and address objects are allowlisted too. Any other key is rejected with a correction-contact message.

Clinical intake remains supported by pre-registration. Staff-owned patient, treatment log, odontogram, and radiograph routes remain separate from patient self-editing.
