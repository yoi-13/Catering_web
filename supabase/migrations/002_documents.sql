-- Private by default. Only the server service role accesses files.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('catering-documents','catering-documents',false,10485760,array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict(id) do nothing;
