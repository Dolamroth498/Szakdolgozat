# UI-validációs ellenőrzőlista – Svindli

## Cél és végrehajtás

Ez az ellenőrzőlista a fejlesztői validációt dokumentálja. Azt vizsgálja, hogy
a szolgáltatásokban elkészült funkciók ténylegesen elérhetők-e a felületről,
a visszajelzések megfelelnek-e a működésnek, és nem maradtak-e fejlesztésközi
maradványok. Kódvizsgálattal és az alkalmazás felületének kipróbálásával
tölthető ki; nem helyettesíti a felhasználói átvételi teszt (UAT)
végigjátszási forgatókönyveit.

A státuszokat csak az ellenőrzés tényleges elvégzése után töltsd ki:
**Megfelelt**, **Nem felelt meg** vagy **Nem végrehajtott**. A felhasználói
folyamatokat elkülönített tesztkörnyezetben ellenőrizd.

## Ellenőrzőlista

| # | Ellenőrzési pont | Ellenőrzés módja / elvárt eredmény | Státusz | Bizonyíték / megjegyzés |
|---|---|---|---|---|
| V-01 | AI-nehézség kiválasztása | A Lobbyban elérhető a könnyű, közepes és nehéz fokozat; a választás látható, az új parti állapotában tárolódik, és az AI döntései megkapják a kiválasztott fokozatot. | | |
| V-02 | Bolt – vásárlás | A felhasználó a felületről kezdeményezhet vásárlást; siker esetén frissül az egyenleg és a feloldott tárgyak listája, hiba esetén érthető üzenet jelenik meg. | | |
| V-03 | Bolt – felszerelés | A feloldott tárgy felszerelhető; a kiválasztott háttér vagy kártyahátlap megjelenik az új játékban. | | |
| V-04 | Profil-jutalmak | A befejezett AI-parti jutalma és eredménye megjelenik a Profilban; a változás frissítés vagy újbóli belépés után is megmarad. | | |
| V-05 | Ranglista | A ranglista a mentett ranglistaadatokat jeleníti meg; ellenőrizd a betöltési, üres és hibaállapotot is. A lista rendezése feleljen meg a pontszám szerinti csökkenő sorrendnek. | | |
| V-06 | Szolgáltatás–UI összekötés | A releváns szolgáltatásmetódusokhoz tartozik elérhető felületi művelet vagy megjelenített adat. Az eredménymentési és vásárlási hibák nem tűnnek el csendben. | | |
| V-07 | Sablon- és fejlesztői szövegek | Keresd át a felhasználónak látható felületeket próbaszövegek, TODO/FIXME jelölések, hibás helyőrzők és már nem aktuális MVP-figyelmeztetések után; ilyen ne jelenjen meg a kész felületen. | | |
| V-08 | Natív böngészőablakok | Kódkereséssel és a fő felhasználói folyamatok kipróbálásával ellenőrizd, hogy nincs `alert()`, `confirm()` vagy `prompt()`; a tájékoztatás és megerősítés az alkalmazás saját felületén történik. | | |
| V-09 | Hibajelzések és akadálymentesség | A fontos hibák látható, érthető módon jelennek meg; ellenőrizd a `role="alert"` / `role="status"` jelölést, valamint hogy a párbeszédablakok billentyűzettel is használhatók. | | |

## Forráskód-ellenőrzés

A projekt gyökeréből futtatható keresés:

```powershell
rg -n "TODO|FIXME|alert\(|confirm\(|prompt\(" src/app
```

A találatokat kézzel kell értékelni: egy hibaüzenetben szereplő „később” szó
például nem feltétlenül sablonmaradvány. A `alert`, `confirm` vagy `prompt`
szövegére nincs találat az elvárt eredmény; a próbaszövegeknél pedig minden,
felhasználó által látható találatot kontextusban kell ellenőrizni.

## Validációs jegyzőkönyv

| Validáció dátuma | Ellenőrző neve | Commit / verzió | Összesítés (megfelelt / nem felelt meg / nem végrehajtott) |
|---|---|---|---|
| | | | |

**Nem megfelelő pontok / hibajegyek:**

________________________________________________________________________

**Ellenőrző aláírása:** __________________________ **Dátum:** ______________
