\set ON_ERROR_STOP 0
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','admin@x'),('00000000-0000-0000-0000-00000000000b','bob@x'),('00000000-0000-0000-0000-00000000000c','eve@x');
update public.profiles set role='admin' where id='00000000-0000-0000-0000-00000000000a';
-- market comes from seed.sql
insert into public.restaurants (market_id,name,lat,lng,source) values ('tucson','Near',32.2230,-110.9750,'manual'),('tucson','Far',32.40,-110.80,'manual');
insert into public.user_swipes (user_id,offering_key,menu_item_id,restaurant_id,category,action) values ('00000000-0000-0000-0000-00000000000b','k','i','r','burgers','like');
select 'near_count', count(*) from public.restaurants_near(32.2226,-110.9747,2);

-- bob (authenticated)
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select 'bob_sees_own_swipes', count(*) from public.user_swipes;
select 'bob_reads_restaurants', count(*) from public.restaurants;
\echo EXPECT_ERROR_bob_insert_restaurant
insert into public.restaurants (market_id,name,lat,lng,source) values ('tucson','Hack',1,1,'manual');
\echo EXPECT_ERROR_bob_role_escalation
update public.profiles set role='admin' where id='00000000-0000-0000-0000-00000000000b';
update public.profiles set display_name='Bob' where id='00000000-0000-0000-0000-00000000000b';
select 'bob_profile', role, display_name from public.profiles;
-- eve
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select 'eve_sees_bob_swipes', count(*) from public.user_swipes;
\echo EXPECT_ERROR_eve_insert_swipe_for_bob
insert into public.user_swipes (user_id,offering_key,menu_item_id,restaurant_id,category,action) values ('00000000-0000-0000-0000-00000000000b','k2','i','r','burgers','like');
-- admin
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
insert into public.restaurants (market_id,name,lat,lng,source) values ('tucson','AdminAdded',32.22,-110.97,'manual');
select 'admin_restaurants', count(*) from public.restaurants;
select 'admin_profiles_visible', count(*) from public.profiles;
reset role;
-- anon
set role anon; select set_config('request.jwt.claim.sub','',false);
select 'anon_reads_restaurants', count(*) from public.restaurants;
\echo EXPECT_ERROR_anon_reads_swipes
select count(*) from public.user_swipes;
reset role;
