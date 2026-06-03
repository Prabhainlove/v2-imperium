
-- Lock down SECURITY DEFINER helpers so they can only run as triggers,
-- not be called directly via PostgREST RPC.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()  FROM PUBLIC, anon, authenticated;
