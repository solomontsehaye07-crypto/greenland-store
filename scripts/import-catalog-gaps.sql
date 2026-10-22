-- Adds products from public.staging_catalog (decision='missing') to public.products as hidden drafts.
-- Names/brands/sizes only; price is a reference price (price_source='mama-t-reference') to be checked by the owner.
with src as (
  select s.*, lower(s.title) t
  from public.staging_catalog s
  where s.decision = 'missing'
    and s.ptype not in ('Gift', 'ReadyMeals')
    and s.title !~* '(^mama t\M|by mama t|fertiggericht|^free |nahrungserg|klistier)'
    and s.title !~* '^(fufu mit|jollof rice mit|waakye rice mit|nigerian fried rice mit|white rice mit|nigerian (chicken|beef) suya)'
),
cat as (
  select src.*,
    case
      when ptype = 'Kosmetik' or (ptype = '' and 'kosmetik-1' = any(collections)) then
        case
          when t ~ '(relaxer|texturi|s curl|wave nouveau kit)' then 19
          when t ~ '(bigen|hair colou?r|haarfarbe|henna|dye)' then 20
          when t ~ '(brush|bürste|comb|kamm|durag|bonnet|wool hair|braid|weave|perücke|wig|gummib|schwamm|sponge|clip|pins|rollers|headwrap|net)' then 21
          when t ~ '(soap|seife)' then 23
          when t ~ '(baby|zahn|tooth|deo|vaseline|petroleum|puder|powder|florida water|gripe)' then 24
          when t ~ '(oil|öl|serum)' and t ~ '(hair|haar|growth|castor|scalp|edge|rosmarin|rosemary)' then 18
          when t ~ '(shampoo|conditioner|hair|haar|curl|edge|leave|masque|mask|pomade|styling|gel|locks?\M|twist)' then 17
          else 22
        end
      when ptype = 'Gewürze & Saucen' then case when t ~ '(sauce|soße|paste|pate|ketchup|mayo|stew|cooking|oil|öl|piment|shito)' then 7 else 6 end
      when ptype in ('Mehlprodukte', 'Fufu', 'Gari') then 5
      when ptype = 'Getränke' then
        case
          when t ~ '(beer|bier|lager|stout|guinness|wein|wine|\mgin\M|whisk|liqu|schnaps|bitters|alcohol|alkohol)' and t !~ '(non[- ]?alc|alkoholfrei|malt|ginger beer)' then 15
          when t ~ '(tea\M|tee|coffee|kaffee|cocoa|kakao|milo|ovaltine|bournvita)' then 14
          else 13
        end
      when ptype = 'Tiefkühl' then 3
      when ptype = 'Fleisch & Fisch' then case when t ~ '(smoked|dried|dry|getrock|geräuch|stockfish|crayfish|salted|gesalzen|bitoyo|powder)' and 'tiefkuhlprodukte-1' <> all(collections) then 9 else 3 end
      when ptype = 'Snacks' then 12
      when ptype = 'Dosenprodukte' then 8
      when ptype = 'Milch- & Kakaoprodukte' then 14
      when ptype = 'Frisches Gemüse' then 2
      when ptype = 'Bohnen' then 4
      when ptype = 'Blätter' then case when t ~ '(frozen|tiefk|gefroren)' or 'tiefkuhlprodukte-1' = any(collections) then 3 when t ~ '(frisch|fresh)' then 2 else 9 end
      when ptype = 'Palmöle & Palmcreme' then 10
      when ptype = 'Erdnussprodukte' then 29
      when ptype = 'Reis & Nudeln' then case when t ~ '(indomie|noodle|nudel|pasta|spaghetti)' then 11 else 4 end
      when ptype = 'Steine' then 11
      when ptype = 'Non-Food' then case when t ~ '(kette|armband|necklace|bracelet)' then 27 when t ~ '(zahn|tooth|gripe)' then 24 when t ~ '(potasse|kanwa|alum)' then 6 when t ~ '(brush|bürste|durag|sponge|schwamm|wool|gummib)' then 21 else 28 end
      when ptype = 'Sonstige Lebensmittel' then 11
      else -- no type on their side
        case
          when 'tiefkuhlprodukte-1' = any(collections) then 3
          when 'fleisch-fisch' = any(collections) or t ~ '(fish|tilapia|hering|kabeljau|shrimp|crayfish)' then 9
          when t ~ '(brush|durag|sponge|wool hair|gummib)' then 21
          when t ~ '(shampoo|conditioner|curl|hair|ors |cantu|edge)' then 17
          when t ~ '(vaseline|baby|toothpaste|zahn)' then 24
          when t ~ '(reis|rice)' and t !~ 'seasoning|sauce' then 4
          when t ~ '(indomie|noodle|nudel)' then 11
          when t ~ '(fufu|flour|mehl|gari|banku|amala|couscous|fonio|millet|mil\M|attieke|tapioca|thiakry|thiacry|degue|monin|sankhal|thiere|arraw|araw|grits|yam|bobolo|bikedi|placali|attote|soungouf)' then 5
          when t ~ '(chips|chin chin|crunchy)' then 12
          when t ~ '(sauce|paste|chili oil|chilli oil|cooking)' then 7
          when t ~ '(seasoning|powder|pulver|pepper|piment|uziza|ofor|nutmeg|oseille)' then 6
          when t ~ '(drink|juice|saft)' then 13
          when t ~ '(jackfruit|lime stone|chalk)' then 11
          when t ~ '(habanero|chili –|bittermelone|frisch)' then 2
          else 11
        end
    end as category_id
  from src
),
expanded as (
  select c.*, v.variant, v.price, v.ord
  from cat c
  cross join lateral (
    select case when cardinality(c.variants) = 0 then null else c.variants[i] end as variant,
           c.prices[i] as price, i as ord
    from generate_subscripts(c.prices, 1) i
  ) v
),
named as (
  select e.*,
    nullif(trim(split_part(e.title, ' - ', 1)), '') filter_brand,
    trim(regexp_replace(regexp_replace(e.title, '\s+[-–]\s+', ' ', 'g'), '\s{2,}', ' ', 'g')) base_title,
    (regexp_match(lower(coalesce(e.variant, e.title)), '(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\M')) sz
  from expanded e
),
final as (
  select n.*,
    case
      when n.variant is null or n.variant = '' then n.base_title
      when n.variant ~* '^(original|default)$' and cardinality(n.variants) = 1 then n.base_title
      when n.variant ~ '\d' then n.base_title || ' ' || n.variant
      else n.base_title || ' (' || n.variant || ')'
    end as new_title,
    case when n.sz is null then null else replace(n.sz[1], ',', '.')::numeric end as qty,
    n.sz[2] as unit,
    row_number() over (order by n.category_id, n.title, n.ord) rn
  from named n
)
insert into public.products (id, sku, slug, title, title_de, brand, category_id, price, tax_rate, weight_g, size_qty, size_unit,
  is_frozen, age_restricted, status, stock, price_source, size_group, qty_discount)
select 791 + rn, 'GRL-' || lpad((841 + rn)::text, 6, '0'),
  trim(both '-' from regexp_replace(translate(lower(new_title), 'äöüßéèêàâçôîïñ', 'aousseeeaacoiin'), '[^a-z0-9]+', '-', 'g')) || '-' || (791 + rn),
  new_title, new_title,
  case when title like '% - %' then filter_brand end,
  category_id, coalesce(price, 0),
  case when category_id in (15) or category_id between 16 and 28 then 19 else 7 end,
  coalesce(case when unit = 'kg' then qty * 1000 when unit = 'g' then qty when unit = 'l' then qty * 1000 when unit = 'ml' then qty end, 500)::int + 50,
  qty, unit,
  category_id = 3, category_id = 15, 'hidden', 0, 'mama-t-reference',
  case when cardinality(variants) > 1 then 'mt-' || id end, true
from final
returning id;
