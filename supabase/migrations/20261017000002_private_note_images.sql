-- ============================================================
-- MAKE THE PHOTO BUCKET PRIVATE
-- DO NOT APPLY until the signed-URL build is live everywhere:
--   * the web app is deployed from this commit, AND
--   * the TestFlight build containing SignedImg is installed on testers' phones.
-- Older builds load photos by their public URL, and those stop loading the
-- moment this runs. Existing rows need no change: the app converts the stored
-- URL to a signed one when it shows the photo, and the existing
-- "note-images owner read" policy lets each user sign only their own folder.
-- ============================================================

UPDATE storage.buckets SET public = false WHERE id = 'note-images';
