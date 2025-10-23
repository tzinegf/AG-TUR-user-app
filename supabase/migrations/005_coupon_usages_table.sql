create table public.coupon_usages (
   id uuid not null default gen_random_uuid (),
   coupon_id uuid not null,
   booking_id uuid null,
   user_id uuid null,
   amount_before numeric(10, 2) not null,
   amount_discount numeric(10, 2) not null,
   amount_after numeric(10, 2) not null,
   applied_at timestamp with time zone not null default now(),
   created_at timestamp with time zone not null default now(),
   constraint coupon_usages_pkey primary key (id),
   constraint uq_coupon_usage_booking unique (booking_id),
   constraint coupon_usages_coupon_id_fkey foreign KEY (coupon_id) references coupons (id) on delete CASCADE,
   constraint coupon_usages_booking_id_fkey foreign KEY (booking_id) references bookings (id) on delete set null,
   constraint coupon_usages_user_id_fkey foreign KEY (user_id) references profiles (id) on delete set null,
   constraint coupon_usages_amount_discount_check check ((amount_discount >= (0)::numeric)),
   constraint coupon_usages_amount_before_check check ((amount_before >= (0)::numeric)),
   constraint coupon_usages_amount_after_check check ((amount_after >= (0)::numeric))
 ) TABLESPACE pg_default;
 
 create index IF not exists idx_coupon_usages_coupon on public.coupon_usages using btree (coupon_id) TABLESPACE pg_default;
 
 create index IF not exists idx_coupon_usages_booking on public.coupon_usages using btree (booking_id) TABLESPACE pg_default;
 
 create index IF not exists idx_coupon_usages_user on public.coupon_usages using btree (user_id) TABLESPACE pg_default;
 
 create unique INDEX IF not exists uq_coupon_usage_user_nonnull on public.coupon_usages using btree (coupon_id, user_id) TABLESPACE pg_default 
 where 
   (user_id is not null);
 
 -- Trigger functions for coupon usage accounting and validation
 create or replace function decrement_coupon_used_count()
 returns trigger as $$
 begin
   update public.coupons
   set used_count = GREATEST(used_count - 1, 0)
   where id = OLD.coupon_id;
   return OLD;
 end;
 $$ language plpgsql;
 
 create or replace function increment_coupon_used_count()
 returns trigger as $$
 begin
   update public.coupons
   set used_count = used_count + 1
   where id = NEW.coupon_id;
   return NEW;
 end;
 $$ language plpgsql;
 
 create or replace function validate_coupon_usage()
 returns trigger as $$
 declare
   c record;
   now_ts timestamptz := coalesce(NEW.applied_at, now());
 begin
   -- Ensure coupon exists
   select * into c from public.coupons where id = NEW.coupon_id;
   if not found then
     raise exception 'Coupon % not found', NEW.coupon_id;
   end if;
 
   -- Validate status
   if c.status is not null and c.status <> 'active' then
     raise exception 'Coupon % is inactive', c.code;
   end if;
 
   -- Validate date window
   if c.starts_at is not null and now_ts < c.starts_at then
     raise exception 'Coupon % not started yet', c.code;
   end if;
   if c.ends_at is not null and now_ts > c.ends_at then
     raise exception 'Coupon % expired', c.code;
   end if;
 
   -- Validate usage limit
   if c.usage_limit is not null and c.used_count >= c.usage_limit then
     raise exception 'Coupon % usage limit reached', c.code;
   end if;
 
   -- Ensure amount_after is consistent and non-negative
   NEW.amount_after := GREATEST(NEW.amount_before - NEW.amount_discount, 0);
 
   return NEW;
 end;
 $$ language plpgsql;
 
 -- Triggers
 create trigger coupon_usage_dec 
 after DELETE on coupon_usages for EACH row 
 execute FUNCTION decrement_coupon_used_count ();
 
 create trigger coupon_usage_inc 
 after INSERT on coupon_usages for EACH row 
 execute FUNCTION increment_coupon_used_count ();
 
 create trigger coupon_usage_validate BEFORE INSERT on coupon_usages for EACH row 
 execute FUNCTION validate_coupon_usage ();