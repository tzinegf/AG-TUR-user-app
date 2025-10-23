create table public.coupons ( 
   id uuid not null default gen_random_uuid (), 
   code text not null, 
   description text null, 
   discount_type text not null, 
   discount_value numeric(10, 2) not null, 
   starts_at timestamp with time zone null, 
   ends_at timestamp with time zone null, 
   status text not null default 'active'::text, 
   usage_limit integer null, 
   used_count integer not null default 0, 
   created_at timestamp with time zone not null default now(), 
   updated_at timestamp with time zone not null default now(), 
   constraint coupons_pkey primary key (id), 
   constraint coupons_code_key unique (code), 
   constraint coupons_discount_type_check check ( 
     ( 
       discount_type = any (array['percentage'::text, 'fixed'::text]) 
     ) 
   ), 
   constraint coupons_status_check check ( 
     ( 
       status = any (array['active'::text, 'inactive'::text]) 
     ) 
   ), 
   constraint coupons_usage_limit_check check ( 
     ( 
       (usage_limit is null) 
       or (usage_limit > 0) 
     ) 
   ), 
   constraint coupons_check check ( 
     ( 
       (discount_value > (0)::numeric) 
       and ( 
         ( 
           (discount_type = 'percentage'::text) 
           and (discount_value <= (100)::numeric) 
         ) 
         or (discount_type = 'fixed'::text) 
       ) 
     ) 
   ), 
   constraint coupons_used_count_check check ((used_count >= 0)), 
   constraint coupons_check1 check ( 
     ( 
       (starts_at is null) 
       or (ends_at is null) 
       or (starts_at <= ends_at) 
     ) 
   ) 
 ) TABLESPACE pg_default; 
 
 create index IF not exists idx_coupons_code on public.coupons using btree (code) TABLESPACE pg_default; 
 
 create index IF not exists idx_coupons_status on public.coupons using btree (status) TABLESPACE pg_default; 
 
 create index IF not exists idx_coupons_ends_at on public.coupons using btree (ends_at) TABLESPACE pg_default;