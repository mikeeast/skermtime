-- An activity now has an execution time (effort) distinct from the screen-time
-- reward it converts into. reward_minutes stays the screen-time payout.
alter table public.chores
  add column duration_minutes integer not null default 10 check (duration_minutes >= 0);

-- Sensible effort times for the seeded library.
update public.chores set duration_minutes = case name
  when 'Duka / duka av'             then 5
  when 'Tömma & fylla diskmaskinen' then 10
  when 'Diska för hand'             then 15
  when 'Torka av bänkar & bord'     then 5
  when 'Laga en enklare måltid'     then 30
  when 'Ta ut sopor & återvinning'  then 10
  when 'Bädda sängen'               then 3
  when 'Städa eget rum'             then 20
  when 'Dammsuga ett rum'           then 10
  when 'Dammsuga hela våningen'     then 25
  when 'Moppa golv'                 then 20
  when 'Städa badrummet'            then 25
  when 'Torka damm'                 then 10
  when 'Starta en tvätt'            then 5
  when 'Hänga / ta in tvätt'        then 10
  when 'Vika & lägga undan tvätt'   then 15
  when 'Vattna blommor'             then 5
  when 'Rensa ogräs'                then 30
  when 'Klippa gräset'              then 40
  when 'Kratta löv'                 then 30
  when 'Skotta snö'                 then 30
  when 'Mata djuren'                then 5
  when 'Rasta hunden'              then 20
  when 'Plocka upp efter hund'      then 10
  when 'Packa upp matvaror'         then 15
  when 'Tvätta bilen'               then 30
  when 'Läxor klara'                then 30
  when 'Läsa 30 minuter'            then 30
  else duration_minutes end
where family_id is null;
