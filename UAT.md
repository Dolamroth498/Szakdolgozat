# Felhasználói átvételi teszt (UAT) – Svindli

## Cél és végrehajtás

Az alábbi hat végigjátszási forgatókönyv a regisztrációtól a játékbeli
jutalmazáson és a ranglista ellenőrzésén át vizsgálja a fő felhasználói
folyamatokat. A UAT kézi, felhasználói szintű ellenőrzés, nem helyettesíti az
egységteszteket vagy a Firestore-szabályok tesztjeit.

A teszteket elkülönített tesztkörnyezetben, új tesztfiókkal végezd. Az UAT
vásárlást, statisztika- és ranglista-módosítást végezhet. A tesztjegyzőkönyvbe
jelszót és PIN-kódot ne írj. A tesztelő csak a lépések tényleges végrehajtása
után jelölje az esetet **Megfelelt**, **Nem felelt meg** vagy **Nem
végrehajtott** értékkel.

Az AI elleni győzelemhez válaszd a könnyű fokozatot és két AI-ellenfelet. A
sikeres és a téves „Svindli!” esetek kiszámítható előállításához használj
háromfős helyi Pass-and-Play partit: a tesztelő vezérelje a három játékost,
és a saját kezükben látott lapok alapján játsszon. Így a bejelentett érték
egyezése vagy eltérése a kihívás előtt ismert. Kihívás csak az első lerakás
után lehetséges. Ne módosíts közvetlenül adatbázist vagy mentett játékállapotot.

## Tesztadatok

| Adat | Kitöltendő |
|---|---|
| Tesztelő neve | |
| Teszt dátuma | |
| Alkalmazás verziója / commit | |
| Böngésző és verzió | |
| Tesztkörnyezet | |
| Tesztfiók azonosítója (jelszó nélkül) | |
| Megjegyzés | |

## Forgatókönyvek

### UAT-01 – Regisztráció és profil létrejötte

**Előfeltétel:** A tesztelő nincs bejelentkezve, egy még nem
használt e-mail-cím.

**Lépések:**
1. Nyisd meg a regisztrációt, és adj meg nevet, egyedi e-mail-címet és a
   felület által elfogadott jelszót.
2. Küldd el a regisztrációt, majd nyisd meg a Profil oldalt.

**Elvárt eredmény:**
- A regisztráció sikeres, a felhasználó bejelentkezett állapotba kerül.
- A Profil oldalon a megadott név és e-mail-cím látszik, a statisztikák és
  az érmeegyenleg megjelennek.
- Sikertelen regisztráció esetén a felület érthető hibát jelez, és nem mutat
  sikeres regisztrációt.

**Tényleges eredmény / megjegyzés:**  
**Állapot:** __________

### UAT-02 – Győzelem AI-ellen, jutalom és statisztika

**Előfeltétel:** UAT-01-ben regisztrált, bejelentkezett tesztfiók.

**Lépések:**
1. Indíts „Gép ellen” partit két, könnyű nehézségű AI-ellenféllel.
2. Játszd végig a partit, és nyerd meg.
3. Jegyezd fel a parti előtti és utáni érmeegyenleget, győzelmeket és
   lejátszott partik számát.

**Elvárt eredmény:**
- A győztes neve megjelenik az eredményablakban.
- A bejelentkezett játékos AI elleni győzelme után 15 érme jár, a profil
  érmeegyenlege ennyivel nő.
- A győzelmek és a lejátszott partik száma eggyel nő a Profilban.

**Tényleges eredmény / előtte → utána:**  
Érme: __________ Győzelem: __________ Lejátszott parti: __________  
**Állapot:** __________

### UAT-03 – Sikeres „Svindli!” kihívás

**Előfeltétel:** Bejelentkezett tesztfiók; háromfős helyi Pass-and-Play parti
indítására alkalmas tesztelő(k), a játékosok PIN-kódjai rendelkezésre állnak.

**Lépések:**
1. Indíts helyi, háromfős emberi partit, és oldd fel egymás után a játékosok
   köreit a saját PIN-kódjaikkal.
2. Az első játékos tegyen le egy lapot.
3. A második játékos szándékosan tegyen le olyan lapot, amelynek értéke nem
   egyezik a kijelzett bemondással.
4. A harmadik játékos hívjon „Svindli!”-t.
5. Figyeld meg a felfordított lapot, az eredményt és a következő kört.

**Elvárt eredmény:**
- A kihívás sikeresnek minősül, mert a lerakott lap értéke eltér a bemondástól.
- A blöffölő felveszi a dobóhalmot, a játék a szabály szerint folytatódik, és
  az eredményüzenet ezt egyértelműen jelzi.

**Tényleges eredmény / megjegyzés:**  
**Állapot:** __________

### UAT-04 – Téves „Svindli!” kihívás

**Előfeltétel:** Az UAT-03-mal megegyező helyi játékbeállítás.

**Lépések:**
1. Indíts új háromfős helyi partit.
2. Az első játékos tegyen le egy lapot.
3. A második játékos tegyen le a kijelzett bemondással egyező értékű lapot.
4. A harmadik játékos ennek ellenére hívjon „Svindli!”-t.
5. Figyeld meg a felfordított lapot, az eredményt és a következő kört.

**Elvárt eredmény:**
- A kihívás tévesnek minősül, mert a lap értéke egyezik a bemondással.
- A kihívó felveszi a dobóhalmot, és a játék a szabály szerint folytatódik
  vagy — ha a szabályok szerint már eldőlt — véget ér.
- Az eredményüzenet egyértelműen jelzi a téves kihívást.

**Tényleges eredmény / megjegyzés:**  
**Állapot:** __________

### UAT-05 – Bolti vásárlás és kártyahátlapcsere

**Előfeltétel:** Bejelentkezett tesztfiók legalább 10 érmével, és a
`back-green` kártyahátlap még nincs feloldva.

**Lépések:**
1. Jegyezd fel az aktuális érmeegyenleget, majd nyisd meg a Boltot.
2. Válaszd a „Kártyahátlapok” kategóriát, és vásárold meg a „Zöld
   geometrikus” hátlapot.
3. A vásárlás után válaszd a „Használat” műveletet a megvásárolt hátlapnál.
4. Ellenőrizd az érmeegyenleget, majd indíts új AI-partit.
5. Figyeld meg a rejtett lapok hátlapját.

**Elvárt eredmény:**
- A vásárlás sikeres, a felület visszajelzést ad, és az érmeegyenleg 10-zel
  csökken.
- A megvásárolt hátlap feloldottként és használatban lévőként jelenik meg.
- Az új partiban a rejtett lapok az újonnan kiválasztott hátlappal jelennek meg.

**Tényleges eredmény / előtte → utána:**  
Érme: __________ Hátlap megjelent: __________  
**Állapot:** __________

### UAT-06 – Ranglista frissülése a parti után

**Előfeltétel:** UAT-02-ben rögzített, befejezett AI-parti; a ranglista
elérhető a tesztkörnyezetben.

**Lépések:**
1. A parti befejezése után nyisd meg a Ranglistát, vagy frissítsd az oldalt.
2. Keresd meg a tesztfiókhoz tartozó bejegyzést, és hasonlítsd össze a
   győzelmek/lejátszott partik számát az UAT-02 előtti értékekkel.

**Elvárt eredmény:**
- A ranglista betöltődik, és a tesztfiók bejegyzése megjelenik.
- A győzelmek és a lejátszott partik száma tükrözi az UAT-02-ben befejezett
  partit.
- A lista pontszám szerint csökkenő sorrendben jelenik meg. A teszt ne várjon
  helyezésváltozást, ha a parti nem módosította a pontszámot.

**Tényleges eredmény / megjegyzés:**  
Győzelem: __________ Lejátszott parti: __________ Helyezés: __________  
**Állapot:** __________

## Összesítő jegyzőkönyv

| Eset | Állapot | Hibaazonosító / megjegyzés |
|---|---|---|
| UAT-01 – Regisztráció | | |
| UAT-02 – AI elleni győzelem | | |
| UAT-03 – Sikeres Svindli | | |
| UAT-04 – Téves Svindli | | |
| UAT-05 – Vásárlás és hátlapcsere | | |
| UAT-06 – Ranglista frissülése | | |

**Átvételi döntés:** ☐ Elfogadva ☐ Feltételekkel elfogadva ☐ Elutasítva  

**Nyitott hibák / feltételek:**  

________________________________________________________________________

**Tesztelő aláírása:** __________________________ **Dátum:** ______________
