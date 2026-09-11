-- Storage RLS cannot constrain createSignedUrl's expiresIn argument. Keep
-- authorization in get_upload_intent under the caller's session, then mint
-- a fixed 60-second URL in the server only. Never grant browser SELECT here.
drop policy lysto_storage_verified_sign on storage.objects;
drop function private.can_sign_verified_upload(text,text);
