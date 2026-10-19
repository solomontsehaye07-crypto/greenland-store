-- Starter recipes linked to products in the catalogue (product ids from the Greenland catalogue).
insert into public.recipes (slug, title, intro, country, sort, image_url) values
('egusi-soup', '{"de":"Egusi-Suppe","en":"Egusi soup"}', '{"de":"Dicke Suppe aus gemahlenen Melonenkernen mit Palmöl, Blattgemüse und getrocknetem Fisch. Dazu passt Fufu oder Pounded Yam.","en":"A thick soup of ground melon seeds with palm oil, leafy greens and dried fish. Serve with fufu or pounded yam."}', 'Nigeria', 10, null),
('jollof-rice', '{"de":"Jollof-Reis","en":"Jollof rice"}', '{"de":"Reis, in einer würzigen Tomaten-Paprika-Sauce gegart. Den Reis hast du meist schon im Vorrat.","en":"Rice cooked in a spicy tomato and pepper sauce. You probably have the rice in your pantry already."}', 'Nigeria', 20, null),
('ogbono-soup', '{"de":"Ogbono-Suppe","en":"Ogbono soup"}', '{"de":"Sämige Suppe aus gemahlenen Ogbono-Kernen mit Palmöl, Flusskrebsen und Stockfisch.","en":"A silky soup of ground ogbono seeds with palm oil, crayfish and stockfish."}', 'Nigeria', 30, null),
('light-soup-fufu', '{"de":"Fufu mit Light Soup","en":"Fufu with light soup"}', '{"de":"Leichte, scharfe Tomatensuppe mit Ziegenfleisch oder Fisch, serviert mit weichem Fufu.","en":"A light, peppery tomato soup with goat meat or fish, served with soft fufu."}', 'Ghana', 40, null),
('palm-nut-soup', '{"de":"Palmnuss-Suppe","en":"Palm nut soup"}', '{"de":"Reichhaltige Suppe auf Palmnuss-Basis mit Fleisch und geräuchertem Fisch, klassisch mit Fufu.","en":"A rich palm nut soup with meat and smoked fish, classically eaten with fufu."}', 'Ghana', 50, null),
('red-red', '{"de":"Red-Red","en":"Red-red"}', '{"de":"Schwarzaugenbohnen in Palmöl-Tomatensauce, oft mit Gari bestreut.","en":"Black-eyed beans in a palm oil and tomato sauce, often topped with gari."}', 'Ghana', 60, null),
('banku-tilapia', '{"de":"Banku mit gegrillter Tilapia","en":"Banku with grilled tilapia"}', '{"de":"Fermentierter Mais-Maniok-Teig mit gegrilltem Fisch und scharfem Shito.","en":"Fermented corn and cassava dough with grilled fish and hot shito."}', 'Ghana', 70, null),
('kontomire-stew', '{"de":"Kontomire-Eintopf","en":"Kontomire stew"}', '{"de":"Eintopf aus Taro-Blättern mit Egusi, Palmöl und geräuchertem Fisch, dazu gekochter Yam.","en":"A stew of cocoyam leaves with egusi, palm oil and smoked fish, served with boiled yam."}', 'Ghana', 80, null),
('doro-wat', '{"de":"Doro Wat","en":"Doro wat"}', '{"de":"Langsam geschmortes Hähnchen in Berbere-Zwiebelsauce, gegessen mit Injera.","en":"Chicken slow-cooked in a berbere and onion sauce, eaten with injera."}', 'Ethiopia', 90, null),
('shiro-wat', '{"de":"Shiro Wat","en":"Shiro wat"}', '{"de":"Cremiger Eintopf aus gewürztem Kichererbsenmehl, vegan und schnell gemacht. Dazu Injera aus Teff.","en":"A creamy stew of spiced chickpea flour, vegan and quick to make. Serve with teff injera."}', 'Ethiopia', 100, null),
('coffee-ceremony', '{"de":"Äthiopische Kaffeezeremonie","en":"Ethiopian coffee ceremony"}', '{"de":"Grüne Bohnen frisch rösten, in der Jebena aufbrühen und in kleinen Tassen servieren, mit Kolo als Snack.","en":"Roast green beans fresh, brew in a jebena and serve in small cups, with kolo as a snack."}', 'Ethiopia', 110, null),
('ndole', '{"de":"Ndolé","en":"Ndolé"}', '{"de":"Bitterblätter mit Erdnüssen und Flusskrebsen, dazu Bobolo oder Kochbananen.","en":"Bitter leaves with peanuts and crayfish, served with bobolo or plantain."}', 'Cameroon', 120, null),
('pondu', '{"de":"Pondu","en":"Pondu"}', '{"de":"Maniokblätter mit Palmöl und Erdnuss, dazu Chikwangue.","en":"Cassava leaves cooked with palm oil and peanuts, served with chikwangue."}', 'DR Congo', 130, null),
('sauce-graine-attieke', '{"de":"Sauce Graine mit Attiéké","en":"Sauce graine with attiéké"}', '{"de":"Palmnuss-Sauce mit geräuchertem Fisch, dazu der luftige Maniok-Couscous Attiéké.","en":"Palm nut sauce with smoked fish, served with light cassava couscous (attiéké)."}', 'Côte d''Ivoire', 140, null),
('sobolo', '{"de":"Sobolo / Zobo (Hibiskus-Drink)","en":"Sobolo / zobo (hibiscus drink)"}', '{"de":"Gekühlter Hibiskus-Tee mit Ingwer und Nelken, mit etwas Panela gesüßt.","en":"Chilled hibiscus tea with ginger and cloves, sweetened with a little panela."}', 'Ghana', 150, null);

with items(slug, pid, essential, note) as (values
 ('egusi-soup',159,true,'{}'),('egusi-soup',96,true,'{}'),('egusi-soup',626,true,'{}'),('egusi-soup',95,true,'{}'),('egusi-soup',273,true,'{}'),('egusi-soup',212,true,'{}'),('egusi-soup',731,false,'{"de":"optional","en":"optional"}'),('egusi-soup',674,false,'{"de":"als Beilage","en":"to serve"}'),
 ('jollof-rice',552,true,'{}'),('jollof-rice',682,true,'{}'),('jollof-rice',435,true,'{}'),('jollof-rice',750,true,'{}'),('jollof-rice',222,true,'{}'),('jollof-rice',352,false,'{}'),('jollof-rice',564,false,'{}'),
 ('ogbono-soup',293,true,'{}'),('ogbono-soup',690,true,'{}'),('ogbono-soup',626,true,'{}'),('ogbono-soup',95,true,'{}'),('ogbono-soup',94,false,'{}'),('ogbono-soup',212,true,'{}'),('ogbono-soup',674,false,'{"de":"als Beilage","en":"to serve"}'),
 ('light-soup-fufu',345,true,'{}'),('light-soup-fufu',140,true,'{}'),('light-soup-fufu',3,false,'{"de":"oder Fisch","en":"or fish"}'),('light-soup-fufu',435,true,'{}'),('light-soup-fufu',212,true,'{}'),
 ('palm-nut-soup',624,true,'{}'),('palm-nut-soup',668,true,'{}'),('palm-nut-soup',3,true,'{}'),('palm-nut-soup',212,true,'{}'),('palm-nut-soup',343,false,'{"de":"als Beilage","en":"to serve"}'),
 ('red-red',277,true,'{}'),('red-red',96,true,'{}'),('red-red',435,true,'{}'),('red-red',211,false,'{"de":"zum Bestreuen","en":"for topping"}'),('red-red',295,false,'{}'),
 ('banku-tilapia',281,true,'{}'),('banku-tilapia',667,true,'{}'),('banku-tilapia',295,true,'{}'),('banku-tilapia',86,false,'{"de":"für die Marinade","en":"for the marinade"}'),
 ('kontomire-stew',489,true,'{}'),('kontomire-stew',480,true,'{}'),('kontomire-stew',96,true,'{}'),('kontomire-stew',3,true,'{}'),('kontomire-stew',69,false,'{"de":"als Beilage","en":"to serve"}'),
 ('doro-wat',351,true,'{}'),('doro-wat',564,true,'{}'),('doro-wat',677,false,'{}'),('doro-wat',623,false,'{"de":"für mehr Schärfe","en":"for extra heat"}'),('doro-wat',738,false,'{"de":"für Injera","en":"for injera"}'),('doro-wat',133,false,'{}'),
 ('shiro-wat',234,true,'{}'),('shiro-wat',351,true,'{}'),('shiro-wat',564,false,'{}'),('shiro-wat',150,false,'{"de":"für Injera","en":"for injera"}'),('shiro-wat',266,false,'{}'),
 ('coffee-ceremony',309,true,'{}'),('coffee-ceremony',790,true,'{}'),('coffee-ceremony',789,false,'{}'),('coffee-ceremony',632,false,'{"de":"als Snack","en":"as a snack"}'),
 ('ndole',731,true,'{}'),('ndole',157,true,'{}'),('ndole',626,true,'{}'),('ndole',151,false,'{"de":"als Beilage","en":"to serve"}'),
 ('pondu',338,true,'{}'),('pondu',690,true,'{}'),('pondu',157,false,'{}'),('pondu',676,false,'{"de":"als Beilage","en":"to serve"}'),
 ('sauce-graine-attieke',685,true,'{}'),('sauce-graine-attieke',208,true,'{}'),('sauce-graine-attieke',3,true,'{}'),('sauce-graine-attieke',212,false,'{}'),
 ('sobolo',579,true,'{}'),('sobolo',751,true,'{}'),('sobolo',616,true,'{}'),('sobolo',565,false,'{}')
)
insert into public.recipe_items (recipe_id, product_id, essential, note)
select r.id, i.pid, i.essential, i.note::jsonb from items i join public.recipes r on r.slug = i.slug join public.products p on p.id = i.pid;

-- Use the main (first) ingredient's photo as the recipe picture.
update public.recipes r set image_url = p.image_url
from (values ('egusi-soup',159),('jollof-rice',682),('ogbono-soup',293),('light-soup-fufu',345),('palm-nut-soup',624),('red-red',277),('banku-tilapia',281),('kontomire-stew',489),('doro-wat',351),('shiro-wat',234),('coffee-ceremony',790),('ndole',731),('pondu',338),('sauce-graine-attieke',685),('sobolo',579)) v(slug, pid)
join public.products p on p.id = v.pid where r.slug = v.slug;
