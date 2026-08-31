param(
    [Parameter(Mandatory=$true)][string]$SourcePath,
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [Parameter(Mandatory=$true)][string]$FlatXmlPath
)

$expectedByFunction = @{
    'ADD BRANCH' = 'Must be able to add a new branch successfully and display it in the branch list.'
    'ADD INVENTORY STOCK' = 'Must be able to add a new stock batch successfully and display it in the batch list.'
    'ADD NEW INVENTORY ITEM' = 'Must be able to add a new inventory item successfully and display it in the inventory list.'
    'ADD NEW PATIENT' = 'Must be able to add a new patient successfully and display the patient in the patient list.'
    'ADD NEW STAFF' = 'Must be able to add a new staff account successfully and display it in the staff list.'
    'ADD SCHEDULE' = 'Must be able to add a new schedule successfully and display it in the schedule list.'
    'AI-ASSISTED RADIOGRAPH REVIEW' = 'Must display the uploaded radiograph, AI-assisted findings, dentist verification status, and patient availability status.'
    'AUTOMATIC BACKUP SETTINGS' = 'Must be able to save the automatic backup settings and display the saved settings when the page is reopened.'
    'BACKUP STATUS AND HISTORY' = 'Must display the backup status, backup history, file availability, and verification result.'
    'BOOK APPOINTMENT' = 'Must be able to book the appointment successfully and display it in My Appointments.'
    'BRANCH ANALYTICS' = 'Must display the branch analytics and the corresponding branch data.'
    'BRANCH STATUS' = 'Must be able to update the branch status and display the updated status in the branch list.'
    'CHANGE EMAIL' = 'Must be able to change the email address successfully and display a confirmation message.'
    'CHANGE PASSWORD' = 'Must be able to change the password successfully, display a confirmation message, and log out the user.'
    'CONTEXTUAL DENTAL HEALTH EDUCATION' = 'Must display the Dental Health Education topics related to the selected Oral Health Management record.'
    'CREATE DATABASE BACKUP' = 'Must be able to create the database backup and display its result in the backup history.'
    'DAILY ORAL HEALTH LOG' = 'Must be able to save the Daily Oral Health Log and display the saved information for the selected date.'
    'DELETE STOCK BATCH' = 'Must be able to delete the selected stock batch and remove it from the batch list.'
    'DENTAL HEALTH EDICATION LIBRARY' = 'Must display the matching Dental Health Education articles and the selected article content.'
    'DENTAL HEALTH EDUCATION LIBRARY' = 'Must display the matching Dental Health Education articles and the selected article content.'
    'DOWNLOAD AND VERIFY BACKUP' = 'Must be able to download or verify the selected backup and display the corresponding result.'
    'EDIT BRANCH' = 'Must be able to save the updated branch information and display it in the branch list.'
    'EDIT INVENTORY ITEM' = 'Must be able to save the updated inventory item information and display it in the inventory list.'
    'EDIT PATIENT' = 'Must be able to save the updated patient information and display it in the patient record.'
    'EDIT PROFILE' = 'Must be able to save the updated profile information and display a confirmation message.'
    'EDIT SCHEDULE/RESCHEDULE' = 'Must be able to save the updated schedule and display it in the schedule list.'
    'EDIT STAFF INFO' = 'Must be able to save the updated staff information and display it in the staff record.'
    'FORGOT PASSWORD' = 'Must display the verification code page after the password reset request is submitted.'
    'FORGOT PASSWORD - OTP' = 'Must display the Reset Password page after the correct OTP is verified.'
    'INTERACTIVE DIGITAL ODONTOGRAM' = 'Must be able to update the digital odontogram and display the saved tooth conditions and treatments.'
    'MANAGE APPOINTMENT' = 'Must be able to cancel or reschedule the selected appointment and display the updated appointment without creating a duplicate.'
    'MATERIAL USAGE LOG' = 'Must be able to save the material usage entry and display it in the material usage list.'
    'MEDICAL AND DENTAL HISTORY' = 'Must be able to save the updated medical and dental history and display the saved information in the patient record.'
    'MY APPOINTMENTS' = 'Must display the patient''s upcoming and previous appointments with their details.'
    'NGITIBOT CARE CONTEXT' = 'Must display the Recommended Visit Window, Oral Health Management information, and relevant Dental Health Education context.'
    'NGITIBOT CHAT' = 'Must display the patient''s message and the corresponding NgitiBot response in the conversation.'
    'NOTIFICATION INBOX' = 'Must display the patient''s notifications and update the read status and unread count when a notification is opened.'
    'NOTIFICATIONS' = 'Must be able to save the notification preferences and display the saved settings when the page is reopened.'
    'ODONTOGRAM' = 'Must display the patient''s digital odontogram and the available tooth conditions and treatments.'
    'ORAL HEALTH CALENDAR & HISTORY' = 'Must display the Oral Health Management information corresponding to the selected calendar date.'
    'ORAL HEALTH TRENDS' = 'Must display the calculated 7-day and 30-day Oral Health Management trends.'
    'PATIENT ACCOUNT LIFECYCLE' = 'Must be able to complete the selected account action and display the patient''s updated account status.'
    'PATIENT BRANCH TRANSFER' = 'Must be able to transfer the patient and display the updated branch assignment.'
    'PATIENT PRE-REGISTRATION' = 'Must be able to submit the pre-registration form successfully and display a confirmation that the activation link was sent.'
    'PATIENT RADIOGRAPH EXPLANATION' = 'Must display the dentist-approved radiograph information and the available AI explanation.'
    'RADIOGRAPH' = 'Must display the patient''s available radiograph images and details.'
    'RECOMMENDED VISIT WINDOW' = 'Must display the Recommended Visit Window with its source, reason, and visit timing.'
    'RESET PASSWORD' = 'Must be able to reset the password successfully and display the Login page.'
    'RESTORE/PERMANENT DELETE REVIEW' = 'Must be able to restore or permanently delete the selected archived record and display the updated archive state.'
    'RUN INTEGRITY CHECKS' = 'Must display the status and affected records for each completed integrity check.'
    'SAFE AUTO-FIX' = 'Must be able to apply the Safe Auto-Fix and display the updated affected records.'
    'SCHEDULE STATUS MANAGEMENT' = 'Must be able to update the appointment status and display the updated status in the schedule list.'
    'SEARCH/FILTER ACTIVITY LOGS' = 'Must display only the activity logs matching the search criteria or display no results when no record matches.'
    'SEARCH/FILTER ARCHIVE RECORDS' = 'Must display only the archived records matching the search and filter criteria or display no results when no record matches.'
    'SEARCH/FILTER INVENTORY' = 'Must display only the inventory records matching the search and filter criteria or display no results when no record matches.'
    'SEARCH/FILTER PATIENT' = 'Must display only the patients matching the search criteria or display no results when no patient matches.'
    'SEARCH/FILTER SCHEDULE' = 'Must display only the schedules matching the search criteria or display no results when no schedule matches.'
    'SEARCH/FILTER STAFF' = 'Must display only the staff records matching the search criteria or display no results when no staff record matches.'
    'SEARCH/FILTER SYSTEM AUDIT LOGS' = 'Must display only the system audit logs matching the search criteria or display no results when no record matches.'
    'SET-UP PASSWORD' = 'Must be able to set up the account password successfully and display the Login page.'
    'STAFF ACCOUNT LIFECYCLE' = 'Must be able to complete the selected account action and display the staff member''s updated account status.'
    'TREATMENT HISTORY' = 'Must display the patient''s available treatment history and treatment details.'
    'TREATMENT LOGS' = 'Must be able to add or delete a treatment log and display the updated treatment log list.'
    'UPDATE SYSTEM CONFIGURATION' = 'Must be able to save the system configuration and display the updated settings.'
    'VIEW ACTIVITY DETAILS' = 'Must display the complete details of the selected activity log.'
    'VIEW AUDIT DETAILS' = 'Must display the complete details of the selected system audit log.'
    'VIEW EMR' = 'Must display the patient''s available Medical and Dental History, Treatment History, Odontogram, and X-Ray records.'
    'VIEW SCHEDULE' = 'Must display the selected patient''s complete schedule information.'
    'WEBSITE APPOINTMENT REQUEST' = 'Must be able to submit the appointment request successfully and display a confirmation message.'
    'WEBSITE CONTENT & MEDIA' = 'Must be able to save the website content or media and display the updated information on the website.'
}

function Get-CellText {
    param($Cell)
    return (($Cell.Range.Text -replace '[\x07\x0D]', '').Trim())
}

function Set-CellText {
    param($Cell, [string]$Text)
    $range = $Cell.Range.Duplicate
    $range.End = $range.End - 1
    $range.Text = $Text
}

$sourceWord = $null
$sourceWasOpened = $false
try {
    try { $sourceWord = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application') } catch {}
    if (-not $sourceWord) {
        $sourceWord = New-Object -ComObject Word.Application
        $sourceWord.Visible = $false
        $sourceWord.DisplayAlerts = 0
        $sourceWasOpened = $true
    }

    $sourceDoc = $null
    foreach ($candidate in $sourceWord.Documents) {
        if ([string]::Equals($candidate.FullName, $SourcePath, [StringComparison]::OrdinalIgnoreCase)) {
            $sourceDoc = $candidate
            break
        }
    }
    $documentWasOpened = $false
    if (-not $sourceDoc) {
        $sourceDoc = $sourceWord.Documents.Open($SourcePath, $false, $true, $false)
        $documentWasOpened = $true
    }
    [IO.File]::WriteAllText($FlatXmlPath, $sourceDoc.WordOpenXML, [Text.UTF8Encoding]::new($false))
    if ($documentWasOpened) { $sourceDoc.Close($false) }
} finally {
    if ($sourceWasOpened -and $sourceWord) { $sourceWord.Quit() }
    if ($sourceWord) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($sourceWord) }
}

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($FlatXmlPath, $false, $false, $false)
    if ($doc.Tables.Count -ne 203) { throw "Expected 203 tables but found $($doc.Tables.Count)." }

    $updated = 0
    for ($i=1; $i -le $doc.Tables.Count; $i++) {
        $table = $doc.Tables.Item($i)
        $functionName = Get-CellText $table.Cell(2,4)
        $role = Get-CellText $table.Cell(3,4)
        if ($functionName -eq 'LOGIN') {
            $expected = "Must be able to log in successfully and display the $role dashboard."
        } else {
            $expected = $expectedByFunction[$functionName]
        }
        if ([string]::IsNullOrWhiteSpace($expected)) {
            throw "No expected result was defined for table $i ($functionName)."
        }
        Set-CellText $table.Cell(9,1) '1'
        Set-CellText $table.Cell(9,2) $expected
        $updated++
    }

    $wdFormatDocumentDefault = 16
    $doc.SaveAs2($OutputPath, $wdFormatDocumentDefault)
    $doc.Close($false)

    $check = $word.Documents.Open($OutputPath, $false, $true, $false)
    try {
        $blank = 0
        for ($i=1; $i -le $check.Tables.Count; $i++) {
            if ([string]::IsNullOrWhiteSpace((Get-CellText $check.Tables.Item($i).Cell(9,2)))) { $blank++ }
        }
        if ($check.Tables.Count -ne 203 -or $blank -ne 0) {
            throw "Verification failed: tables=$($check.Tables.Count), blank expected results=$blank."
        }
        "UPDATED=$updated; TABLES=$($check.Tables.Count); BLANK_EXPECTED=$blank"
    } finally {
        $check.Close($false)
    }
} finally {
    $word.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
