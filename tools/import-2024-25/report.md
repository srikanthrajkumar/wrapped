# 2024-25 reference import

Written by `tools/import-2024-25/import.ts` (T045) against catalog 2026.11.01-1. Every Item
of last season's sheet went through the app's matching (`app/src/catalog/match.ts`): a title
matches a Composition only when it folds to exactly one song's title or title alias, or when
the Raga and Composer logged with it pick one out of several songs of that title.

## The four rates (SC-005)

| Outcome | Items | Share |
|---|---|---|
| Matched a Composition | 70 | 36.3% |
| "?" | 1 | 0.5% |
| Special form, no Composition | 10 | 5.2% |
| Unresolved | 112 | 58.0% |
| **Resolved without cleanup** | **81 of 193** | **42.0%** (target 90%) |

Search: for 61 of the 70 matched Items, typing the title as the sheet has it
puts the matched song in the search box's top 3. For 55 of the 112 Unresolved
Items, the top 3 holds a song in the Raga logged with it, a rough sign the search box would have
offered the right song where exact matching could not.

## Details

How each Detail as typed in the sheet matched (an Item's Ragas each count once).

| Detail | Values | Matched | "?" | Not applicable | Unresolved | Unresolved as typed |
|---|---|---|---|---|---|---|
| raga | 204 | 174 | 1 | 1 | 28 | Hamsadhwani (4), Ragamalika (3), Kaanada (2), Kalavati (2), Kedaragowlai (2), Mayamalavagowlai (2), Reetigowlai (2), Amrutavarshini, Chakravaham, Chalanattai, Ganga, Gowlai, Kalyanavasantham, Kannada, Kirnavali, Mishra Pahadi, Nattakurunji, Padi |
| tala | 193 | 165 | 1 | 1 | 26 | Rupakam (20), Khanda Jati Triputa (2), Amrutavarshini, Chaturshra Jati Triputa, Chatushra Jati Rupakam (4 Kalai), Khandajati Triputa |
| composer | 193 | 120 | 10 | 1 | 62 | M Balamuralikrishna (8), Purandaradasa (8), Patnam Sri Subramania Iyer (6), Gopalakrishna Bharati (5), HN Muttiah Bhagavatar (4), A Kanyakumari (3), Thanjavur Quartet (3), Ganesh Kumaresh (2), Kanakadasa (2), Perumal Murugan (2), Amrutha Venkatesh, Annamayya, Bhadrachala Ramadasu, Chinnayya, Dandapani Desikar, Ganesh Rajagopalan, Konnakathu Janaki Amma (Disputed), Kulasekara Azhvar, MD Ramanathan, Meerabai, Ramana Balachandhran, Rangasvāmy Naṭṭuvanār, Sant Chokhamela, Sivananda, Tarangambadi Pancanatha Iyer, Tirukkokaranam Vaidyanatha Bhagavathar, Tiruvotriyur Thiyagaiyer, TR Subramaniam, Ulundurpettai Shankmukham |
| language | 193 | 182 | 2 | 8 | 1 | Adi |
| subject | 193 | 166 | 7 | 8 | 12 | Benefits to the one who sings, Dvaita / Advaita, Ganga, Javali, Kuchela's wife, Love, M Balamuralikrishna's Gurus, Nadam, Ramana Bhagawan, Shiva, Vishnu, Thillana, Yamuna |

## Unresolved Items

Each with why, and what the search box offers for the title as typed.

| Row | Title | Raga | Composer | Why | Search top 3 |
|---|---|---|---|---|---|
| 1 | Gananatham Smarami Anisham | Kanakangi | Akkarai Sornalatha | no song has this title |  |
| 2 | Sri Saraswati Namostute | Arabhi | Mutthuswami Dikshitar | 2 songs have this title; the logged Raga and Composer leave 2 | Shree Saraswati Namostute (Arabhi, Muthuswami Dikshitar); Shri Sarasvati Namostute (Arabhi, Muthuswami Dikshitar) |
| 3 | Birana Brova Ite | Kalyani | Tarangambadi Pancanatha Iyer | no song has this title |  |
| 8 | Gam Ganapathe | Hamsadhwani | HN Muttiah Bhagavatar | 2 songs have this title; the logged Raga and Composer leave 2 | Gam Ganapate (Hamsadhvani, Muthiah Bhagavatar); Gam Ganapate (Hamsadhvani, Muthiah Bhagavatar); Gam Ganapate Karunakarane (Nata, Lalita Venkataraman) |
| 9 | Sanatana Parama | Phalamanjari | Thyagaraja | no song has this title | Sanatana Parama Pavana (Phalamanjari, Tyagaraja); Patala Vasane Parameshane (Punnagavarali, Unknown); Paramananda Svarupane (Shankarabharana, Lalita Santanam) |
| 10 | Na Jeevadhara | Bilahari | Thyagaraja | 2 songs have this title; the logged Raga and Composer leave 2 | Na Jivadhara (Bilahari, Tyagaraja); Na Jeevadhara (Bilahari, Tyagaraja); Sujana Jivana Rama (Khamas, Tyagaraja) |
| 11 | Sri Vishwanatham | Ragamalika | Mutthuswami Dikshitar | 2 songs have this title; the logged Raga and Composer leave 2 | Shri Vishvanatham Bhajeham (Shri, Arabhi, Gauri, Nata, Gaula, Mohana, Sama, Lalita, Bhairava, Saranga, Shankarabharana, Kambhoji, Devakriya, Bhupala, Muthuswami Dikshitar); Shri Vishvanatham (Bhairavi, Papanasam Sivan); Shri Vishvanatham (Natakuranji, Lalitha Dasar) |
| 12 | Aparadhamula | Rasali | Thyagaraja | no song has this title | Aparadhamula Norva (Rasali, Tyagaraja); Aparadhamula Norva Samayamu (Rasali, Tyagaraja); Aparadhamulamanpi Adukovayya (Darbar, Tyagaraja) |
| 13 | Swaralahari | Vasanti | A Kanyakumari | no song has this title |  |
| 15 | Thillana | Sindhubhairavi | A Kanyakumari | 5 songs have this title; the logged Raga and Composer leave 5 | Tillana (Behag) (Behag, Mysore VenkaTagiriappa); Tillana (Bilahari) (Bilahari, AriyakkuDi Raamaanuja Aiyyangaar); Tillana (Dhanashree) (Dhanashri, Swathi Thirunal) |
| 19 | Varanamukhava | Hamsadhwani | Koteeswara Iyer | no song has this title | Varana Mukhava (Hamsadhvani, Koteeswara Iyer); Varana Mukhava Tunai Varuvai (Hamsadhvani, Koteeswara Iyer); Varana Mukha Ganapatiye (Rudrapriya, T.M.Thiagarajan) |
| 20 | Vela Va Vadivela | Kiravani | Koteeswara Iyer | no song has this title | Vadivela Va Va (Todi, Swarna Venkatesa Dikshitar); Va Va Vadivela (Arabhi, Saravanabhavananda); Vadivela Vandarul (Shanmukhapriya, Sundaraja (Parvati Srinivasan)) |
| 21 | Edayya Gati | Chalanattai | Koteeswara Iyer | 2 songs have this title; the logged Raga and Composer leave 2 | Edayya Gati (Chalanata, Koteeswara Iyer); Edayya Gati (Chalanata, Koteeswara Iyer); Unnaiyallal Gati Edayya (Kamavardhani, Unknown) |
| 25 | Arul Seyyavendum ayya | Rasikapriya | Koteeswara Iyer | no song has this title | Ayya Ni Arul Sheyyavendum (Darbar, DEshika Vinaayakam PiLLai); Arul Sheyya Venumayya (Rasikapriya, Koteeswara Iyer) |
| 26 | Saraguna Gavumu | Thodi | M Balamuralikrishna | no song has this title | Saraguna Gavumu (V) (Todi, Balamuralikrishna) |
| 27 | Ganasudharasa | Nattai | M Balamuralikrishna | no song has this title | Gana Sudharasame (Ragavardhani, Balamuralikrishna); Gana Sudharasa Pana (Nata, Balamuralikrishna); Gana Sudhara Rasa (Kharaharapriya, Mysore Vasudevachar) |
| 30 | Marulukonnade | Chenjurutti | M Balamuralikrishna | no song has this title | Maguva Marulukonnadira (Amritavarshini, H.YOganarasimham); Marulu Konnane (Jhanjuti, Balamuralikrishna); Marulu Konnadira (Khamas, Poochi Srinivasa Iyengar) |
| 31 | Bhavame Mahabhagayamu | Kaapi | M Balamuralikrishna | no song has this title |  |
| 36 | Heccharikaga rara | Yadukulakamboji | Thyagaraja | no song has this title | Heccharikaga Rara He Ramachandra (Yadukulakambhoji, Tyagaraja) |
| 37 | Makelara | Ravichandrika | Thyagaraja | no song has this title | Makelara Vicharamu (Ravichandrika, Tyagaraja); Makelara Vicharamu (Ravichandrika, Tyagaraja); Makella Rajanamuto (Lalita, Annamacharya) |
| 38 | Nadaloludai | Kalyanavasantham | Thyagaraja | 2 songs have this title; the logged Raga and Composer leave 2 | Nadaloludai (Kalyanavasanta, Tyagaraja); Nadaloludai (Kalyanavasanta, Tyagaraja) |
| 39 | Saravana Bhava | Pashupatipriya | HN Muttiah Bhagavatar | no song has this title | Sharavana Bhava Guhane (Madhyamavati, Papanasam Sivan); Sharavana Bhava Shivananda (Kedara, Neelakanta Sivan); Sharavana Bhava Sura (Khamas, Neelakanta Sivan) |
| 40 | Meenakshi Me Mudham | Purvikalyani | Mutthuswami Dikshitar | no song has this title | Minakshi Memudam Dehi (Gamakakriya, Muthuswami Dikshitar) |
| 41 | Mahaganapatim | Nattai | Mutthuswami Dikshitar | no song has this title | Mahaganapatim Bhajeham (Amritavahini, Jayachamaraja Wadiyar); Mahaganapatim Manasa (Nata, Muthuswami Dikshitar); Mahaganapatim Vande (Todi, Muthuswami Dikshitar) |
| 42 | Lavanya Rama | Poornashadjam | Thyagaraja | 2 songs have this title; the logged Raga and Composer leave 2 | Lavanya Rama (Purnashadjam, Tyagaraja); Lavanya Rama (Purnashadjam, Tyagaraja); Lambodara (Navarasakannada, Muthiah Bhagavatar) |
| 43 | Duddukugala | Gowlai | Thyagaraja | no song has this title | Duduku Gala Nanne Dora (Gaula, Tyagaraja); Duduku Gala Nanne (Gaula, Tyagaraja) |
| 44 | Panchanadeesha Pahimaam | Poornachandrika | Patnam Sri Subramania Iyer | no song has this title |  |
| 45 | Palintuvo | Kantamani | Thyagaraja | no song has this title | Palintuvo Palincha (Kantamani, Tyagaraja); Palintuvo Palincha (Kantamani, Tyagaraja) |
| 46 | Intha Sowkhyamani | Kaapi | Thyagaraja | no song has this title | Inta Sowkhyamani Ne (Kapi, Tyagaraja) |
| 47 | Chamaki | Dwijavanti | ? | no song has this title | Kuchamaghi (Dharmavati, Arunagirinathar); Nichamaina Navalla (Gundakriya, Annamacharya); Marigincha Mari Leva (Nadanamakriya, Annamacharya) |
| 48 | Muthai Tharu | Shanmukhapriya | Arunagirinathar | no song has this title | Muttaitaru (Gaula, Arunagirinathar); Tagumo Muraiyo Tarunam (Shriranjani, K. Ramaraj); Mutrilum Kattarulvaye (Dhanyasi, Kavi Kunjara Bharati) |
| 50 | Bhagyadalakshmi | Shri | Purandaradasa | no song has this title | Bhagyada Lakshmi (Madhyamavati, Purandara Dasa); Bhagyada Lakshmi Baramma (Madhyamavati, Purandara Dasa); Bhagyada Lakshmi Baramma (Shri, Purandara Dasa) |
| 51 | Chalamela | Nattakurunji | Rangasvāmy Naṭṭuvanār | 2 songs have this title; the logged Raga and Composer leave 2 | Chalamela (Deshyatodi, Veenai Kuppayyar); Chalamela (Darbar, Tiruvottiyur Tyagayya); Chalamela Chesevu (Narayanagaula, Muthiah Bhagavatar) |
| 52 | Enna Ganurama | Pantuvarali | Thyagaraja | no song has this title | Ennaganu Rama Bhajana (Kamavardhani, Bhadrachala Ramadas); Ennaganu Rama Bhajana (Kamavardhani, Bhadrachala Ramadas) |
| 54 | Okaparijudaka rara | Kalavati | Thyagaraja | no song has this title |  |
| 55 | Aparama Bhakti | Pantuvarali | Thyagaraja | no song has this title | Appa Rama Bhakti (Kamavardhani, Tyagaraja); Appa Rama Bhakti Yento (Kamavardhani, Tyagaraja); Bhajana Seyave Manasa Parama Bhaktito (Kalyani, Tyagaraja) |
| 57 | Senthilvaal Murugayya | Hamirkalyani | TR Subramaniam | no song has this title | Sendil Vazh Murugayya (Hamirkalyani, T.R. Subramaniam) |
| 58 | Pavanatmajagaccha | Nattai | Mutthuswami Dikshitar | no song has this title | Pavanatmajagachcha (Chalanata, Muthuswami Dikshitar) |
| 59 | Durmargachara | Ranjani | Thyagaraja | no song has this title | Durmarga Charadhamulanu (Ranjani, Tyagaraja); Durmarga Charadhamulanu Dora Nivana Jalara (Ranjani, Tyagaraja) |
| 60 | Vararagalaya | Chenchukamboji | Thyagaraja | no song has this title | Vara Raga Layagnulu (Chenchukambhoji, Tyagaraja) |
| 61 | Swaram Composition | Nalinakanthi | Ganesh Rajagopalan | no song has this title |  |
| 62 | Thyagaraja Yogavaibhavam | Anandabhairavi | Mutthuswami Dikshitar | no song has this title | Tyagaraja Yoga Vaibhavam (Anandabhairavi, Muthuswami Dikshitar); Tyagaraja Yoga Vaibhavam (Anandabhairavi, Muthuswami Dikshitar) |
| 63 | Swaram Composition | Pantuvarali | Ganesh Kumaresh | no song has this title |  |
| 64 | Marukelara | Jayantashri | Thyagaraja | no song has this title | Marugelara O (Jayantashri, Tyagaraja); Marugelara O (Jayantashri, Tyagaraja) |
| 66 | Vaigainadi Karaioram | ? | Ulundurpettai Shankmukham | no song has this title |  |
| 68 | Bhagyadalakshmi | Madhyamavati | Purandaradasa | no song has this title | Bhagyada Lakshmi (Madhyamavati, Purandara Dasa); Bhagyada Lakshmi Baramma (Madhyamavati, Purandara Dasa); Bhagyada Lakshmi Baramma (Shri, Purandara Dasa) |
| 69 | Harivarasanam | Madhyamavati | Konnakathu Janaki Amma (Disputed) | no song has this title |  |
| 71 | Narada Gana Lola | Atana | Thyagaraja | no song has this title | Narada Ganalola (Athana, Tyagaraja); Narada Ganalola (Athana, Tyagaraja); Shri Narada Ganalola (Surati, Unknown) |
| 72 | Okaparijudaka rara | Kalavati | Thyagaraja | no song has this title |  |
| 75 | Paramatmudu | Vagadeeshwari | Thyagaraja | no song has this title | Paramatmudu Sarva Paripurnudu (Bhairavi, Annamacharya); Paramatmudu Velugu (Vagadishvari, Tyagaraja); Paramatmudu Velugu (Vagadishvari, Tyagaraja) |
| 78 | Lavanya Rama | Poornashadjam | Thyagaraja | 2 songs have this title; the logged Raga and Composer leave 2 | Lavanya Rama (Purnashadjam, Tyagaraja); Lavanya Rama (Purnashadjam, Tyagaraja); Lambodara (Navarasakannada, Muthiah Bhagavatar) |
| 79 | Janaro Ee Mohamu | Khamas | Chinnayya | 2 songs have this title; the logged Raga and Composer leave 2 | Janaro I Mohamu (Khamas, Chinniah (TQ)); Janaro I Mohamu (Khamas, Poochi Srinivasa Iyengar) |
| 80 | Jambupate | Yamunakalyani | Mutthuswami Dikshitar | no song has this title | Jambupate Mam Pahi (Yamunakalyani, Muthuswami Dikshitar) |
| 81 | Padavini Sadbhakti | Saalagabhairavi | Thyagaraja | no song has this title | Padavi Ni Sadbhaktiyu (Salagabhairavi, Tyagaraja) |
| 83 | Sudhandhiram Vendum | Maand | Perumal Murugan | no song has this title |  |
| 85 | Dhaava Vibho | Yamunakalyani | ? | no song has this title |  |
| 89 | Govindagiridhara | Darbarikaanada | Narayana Teerthar | no song has this title |  |
| 91 | Manavyalakinchara | Nalinakanthi | Thyagaraja | no song has this title | Manavi Nalagincha (Nalinakanti, Tyagaraja) |
| 92 | Mix of 3 Compositions |  |  | no song has this title |  |
| 94 | Teliyaleru Rama | Dhenuka | Thyagaraja | 2 songs have this title; the logged Raga and Composer leave 2 | Teliyaleru Rama (Dhenuka, Tyagaraja); Teliyaleru Rama (Dhenuka, Tyagaraja) |
| 96 | Vanchatonu Navagalu | Karnaranjani | HN Muttiah Bhagavatar | no song has this title |  |
| 98 | Un Padamalarinai Maravaine | Kalyani | Ambujam Krishna | no song has this title |  |
| 100 | Thillana | Brindavani | M Balamuralikrishna | 5 songs have this title; the logged Raga and Composer leave 5 | Tillana (Behag) (Behag, Mysore VenkaTagiriappa); Tillana (Bilahari) (Bilahari, AriyakkuDi Raamaanuja Aiyyangaar); Tillana (Dhanashree) (Dhanashri, Swathi Thirunal) |
| 101 | Sami Dayajuda | Kedaragowlai | Tiruvettiyoor Tyagayya | no song has this title | Sami Dayajudavayya (Nata, Chitravina Ravikiran); Sami Daya Jooda (Kedaragaula, Tiruvottiyur Tyagayya); Sami Daya Juda Manich (Kedaragaula, Tiruvottiyur Tyagayya) |
| 103 | Kamalamba Samrakshatu | Anandabhairavi | Mutthuswami Dikshitar | no song has this title | Kamalamba Samrakshatu Mam (Anandabhairavi, Muthuswami Dikshitar) |
| 104 | Bhogindra Shayinam | Kuntalavarali | Swati Tirunal | 2 songs have this title; the logged Raga and Composer leave 2 | Bhogeendra Shayinam (Kuntalavarali, Swathi Thirunal); Bhogindra Shayinam (Kuntalavarali, Swathi Thirunal) |
| 105 | Maruvakudaya | Mohanam | Garbhapurivasa | no song has this title | Maruvakudaya Mohananga (Mohana, Gharbapurivaasa); Maruvakadaya Mohananga (Mohana, Gharbapurivaasa) |
| 107 | Tamburi Meetidawa | Sindhubhairavi | Purandaradasa | 2 songs have this title; the logged Raga and Composer leave 2 | Tamboori Meettidava (Sindhubhairavi, Purandara Dasa); Tamburi Mittidava (Sindhubhairavi, Purandara Dasa) |
| 109 | Vararaga | Sankarabharanam | Mysore Vasudevachar | no song has this title | Vara Raga (Shenchukambhoji, Tyagaraja); Vara Raga Layagnulu (Chenchukambhoji, Tyagaraja); Svararaga Sangita (Dvijavanti, Mangalam Ganapati) |
| 110 | Natamadum Nadanadi | Poorvikalyani | Gopalakrishna Bharati | no song has this title |  |
| 111 | Kalakanti | Neelambari | Swati Tirunal | no song has this title | raga Kalakanthi; raga Kalakanti; Kalakanthi Kalitashiva (Mohana, Ganapati Sachchidananda) |
| 113 | Manadirkkugandadu | Sindhubhairavi | Thanjavur Shankara Aiyyar | no song has this title | Manadirk-kughandadu (Sindhubhairavi, Tanjavur Shankara Iyer); Mandirkk-ughandadu (Sindhubhairavi, Tanjavur Shankara Iyer) |
| 115 | Karunimpa | Sahana | Tiruvotriyur Thiyagaiyer | no song has this title | Karunimpa Idi (Shahana, Tiruvottiyur Tyagayya); Karunimpa Idi Manichi (Shahana, Tiruvottiyur Tyagayya); Karunimpa Samayamu (Kosala, B.M.Sundaram) |
| 116 | Varanamukhava | Hamsadhwani | Koteeswara Iyer | no song has this title | Varana Mukhava (Hamsadhvani, Koteeswara Iyer); Varana Mukhava Tunai Varuvai (Hamsadhvani, Koteeswara Iyer); Varana Mukha Ganapatiye (Rudrapriya, T.M.Thiagarajan) |
| 118 | Tamadam En | Thodi | Papanasam Sivan | no song has this title | Tamadam En Chakrada (Sama, Agastyar); Tamadam En Dayapari (Hamirkalyani, Sughandhisri K); Innum En Tamadam (Surati, Rukmini Ramani) |
| 122 | Vararagalaya | Chenchukamboji | Thyagaraja | no song has this title | Vara Raga Layagnulu (Chenchukambhoji, Tyagaraja) |
| 124 | Nee Matrum | Kaapi | Perumal Murugan | no song has this title | Chalamu Seya Nikumera (Mohana, Matrubhutiah); Amarum Amarinil (Ramapriya, Arunagirinathar); Emmatram Inda Manidan (Begada, T. Lakshmana Pillai) |
| 125 | Gananayakam | Poornashadjam | Mutthuswami Dikshitar | no song has this title | Gananayakam Bhajeham (Rudrapriya, Muthuswami Dikshitar); Gananayakam Vinayakam (Chapu, C. Rangiah); Shri Gananayakam (Bhairavi, Tulaseevanam) |
| 126 | Neekela Dayaradu | Sarasangi | Ramaswamy Sivan | 3 songs have this title; the logged Raga and Composer leave 2 | Neekela Dayaradu (Sarasangi, Raamaswaamy Shivan); Nikela Dayaradu (Kadanakutuhala, Mysore Vasudevachar); Nikela Dayaradu (Sarasangi, Raamaswaamy Shivan) |
| 131 | Ramanikku Mannan Mudi | Anandabhairavi | Arunachala Kavi | no song has this title | Ramanukku Mannan Mudi (Hindola, Arunachala Kavi) |
| 132 | Sri Gurunapalitosmi | Padi | Mutthuswami Dikshitar | no song has this title | Shri Guruna Palitosmi (Padi, Muthuswami Dikshitar) |
| 135 | Mannu Pugazh Kosalai | Ragamalika | Kulasekara Azhvar | no song has this title |  |
| 137 | Parakela Nannu | Kedaragowlai | Shyama Shastri | 2 songs have this title; the logged Raga and Composer leave 2 | Parakela Nannu (Kedaragaula, Syama Sastri); Parakela Nannu (Kedaragaula, Syama Sastri) |
| 140 | Haridasulu Vedale | Yamunakalyani | Thyagaraja | no song has this title | Haridasulu Vedalu (Yamunakalyani, Tyagaraja); Haridasulu Vedalu Mucchata Gani Anandamaye (Yamunakalyani, Tyagaraja) |
| 144 | Jathiswaram | Ragamalika | Thanjavur Quartet | no song has this title | Sa Sa Ni Pa Ga Ri Sa (Jatiswaram) (Hamsadhvani, Madurai N.Krishnan); Sarasadala Nayane (Todi, Mayuram Viswanatha Sastri); Shrinivasan Shridevi (Svarajatj) (Kedaragaula, Suguna Purushothaman) |
| 147 | Samiye Azhitthu Va Dee | Khamas | Thanjavur Quartet | no song has this title | Samiyai Azhaittu Vadi Sakhiye (Khamas, Tanjavur Quartette); Samiyai Azhaittu Vadi (Kambhoji, Ambujam VEdAntam); Samiyai Azhaittu Vadi (Kalyani, Ponnaiah Pillai) |
| 148 | Shri Subramanyo Mam Rakshatu | Thodi | Mutthuswami Dikshitar | no song has this title | Shri Subrahmanyo Mam Rakshatu (Todi, Muthuswami Dikshitar) |
| 149 | Haridasulu Vedale | Yamunakalyani | Tyagaraja | no song has this title | Haridasulu Vedalu (Yamunakalyani, Tyagaraja); Haridasulu Vedalu Mucchata Gani Anandamaye (Yamunakalyani, Tyagaraja) |
| 153 | Tarunam Idamma | Gowlipantu | Shyama Shastri | 2 songs have this title; the logged Raga and Composer leave 2 | Tarunam Idamma Dayai (Gaula, Nila Ramamurti); Tarunam Idamma Dayai (Nasikabhushani, Madurai G.S. Mani); Tarunam Eedamma (Gaulipantu, Syama Sastri) |
| 154 | Janani Ninnuvina | Reetigowlai | Subbaraya Shastri | 2 songs have this title; the logged Raga and Composer leave 2 | Jananee Ninnuvina (Ritigaula, Subbaraaya Shaastree); Janani Ninnuvina (Ritigaula, Subbaraaya Shaastree) |
| 156 | Challare Ramachandhrudu | Ahiri | Thyagaraja | no song has this title |  |
| 157 | Emayya Rama | Kambhoji | Bhadrachala Ramadasu | 2 songs have this title; the logged Raga and Composer leave 2 | Emayya Rama (Kambhoji, Bhadrachala Ramadas); Emayya Rama (Kambhoji, Bhadrachala Ramadas); Emayya Rama Enduku (Kambhoji, Mangalam Ganapati) |
| 160 | Payoji Maine | Mishra Pahadi | Meerabai | no song has this title | Payoji Main Ne (Bhajan) (, Meera) |
| 162 | Mayaladi | Thodi | Pattabhiramayya | no song has this title | Mayaladi Mandu (Todi, PaTTaabhiraamayyaa); E Mayaladira Na Sami (Huseni, Merattur Venkatarama Shastri OR Ponniah Pillai); raga Mayalalit |
| 163 | Ado Hogona Baro Ranga | Durga | Purandaradasa | no song has this title |  |
| 166 | Sagara Shayana Vibho | Bhageshree | MD Ramanathan | no song has this title |  |
| 167 | Neekela Dayaradu | Sarasangi | Ramaswamy Sivan | 3 songs have this title; the logged Raga and Composer leave 2 | Neekela Dayaradu (Sarasangi, Raamaswaamy Shivan); Nikela Dayaradu (Kadanakutuhala, Mysore Vasudevachar); Nikela Dayaradu (Sarasangi, Raamaswaamy Shivan) |
| 169 | Abir Gulal | Bhoopali | Sant Chokhamela | no song has this title | Ramudu Lokabhiramudu Dayi (Mayamalavagaula, Annamacharya); Devaki Tan Kula (Anandabhairavi, Vasanta, Abheri, Mayamalavagaula, Nilambari, Ambujam Krishna); Pranava Nadamenum (Gambhiranata, Arabhi, Bilahari, Mayamalavagaula, Balahamsa, Charukesi, Athana, Niranjani, Gaurimanohari, Navaroj, Sindhubhairavi, Kamavardhani, Ritigaula, Chakravaka, Kalyani, Saveri, Hamsanandi, Shilangi, Behag, B.M.Sundaram) |
| 170 | Aparadhamula Niyu | Lathangi | Patnam Sri Subramania Iyer | no song has this title | Aparadhamulanniyu (Latangi, Patnam Subramania Iyer); Aparadhamulanniyu (Latangi, Patnam Subramania Iyer) |
| 172 | Nera Nammithi | Kaanada | Poochi Srinivasa Iyengar | no song has this title | Nera Nammiti Ninune (Dhanyasi, R.N.Doreswamy); Ninne Nera Nammiti (Bhairavi, Veenai Kuppayyar); Neranammiti (Kanada, Poochi Srinivasa Iyengar) |
| 176 | Raghuvamsa Sudha | Kadanakuthuhalam | Patnam Sri Subramania Iyer | no song has this title | Raghuvamsha Sudhambudhi (Kadanakutuhala, Patnam Subramania Iyer) |
| 178 | Bhagirathi Devi | Ganga | Purandaradasa | no song has this title |  |
| 180 | Swaralahari | Shuddha Saveri | A Kanyakumari | no song has this title |  |
| 181 | Muralidhara Gopala | Maand | Periyasaami Thooran | 2 songs have this title; the logged Raga and Composer leave 2 | Muraleedhara Gopala (Mand, Periyasami Thooran); Muralidhara Gopala (Mand, Periyasami Thooran) |
| 183 | Kumaran Thal Paninde | Yadukulakamboji | Papanasam Sivan | no song has this title |  |
| 184 | Ranganayakam | Nayaki | Mutthuswami Dikshitar | no song has this title | Ranganayakam Bhavaye (Nayaki, Muthuswami Dikshitar); Ranganayakam Bhavayeham (Nayaki, Muthuswami Dikshitar); Ranganayaka Bhujanga (Kedaragaula, Maargadarshi SEsha Aiyyangaar) |
| 185 | Sarasamukhi Sakala | Gowdamalhar | HN Muttiah Bhagavatar | no song has this title |  |
| 187 | Mahaganapatim | Nattai | Mutthuswami Dikshitar | no song has this title | Mahaganapatim Bhajeham (Amritavahini, Jayachamaraja Wadiyar); Mahaganapatim Manasa (Nata, Muthuswami Dikshitar); Mahaganapatim Vande (Todi, Muthuswami Dikshitar) |
| 188 | Enthamuddo | Bindumalini | Thyagaraja | no song has this title | Entamuddo Enta (Bindumalini, Tyagaraja); Entamuddo Enta Sogaso Evarivalla Varnimpa (Bindumalini, Tyagaraja); Entahudo Ninna (Madhyamavati, Purandara Dasa) |
| 189 | Aparama Bhakti | Pantuvarali | Thyagaraja | no song has this title | Appa Rama Bhakti (Kamavardhani, Tyagaraja); Appa Rama Bhakti Yento (Kamavardhani, Tyagaraja); Bhajana Seyave Manasa Parama Bhaktito (Kalyani, Tyagaraja) |
| 190 | Nagumomu Ganaleni | Abheri | Thyagaraja | 2 songs have this title; the logged Raga and Composer leave 2 | Nagumomu Ganaleni (Abheri, Tyagaraja); Nagumomu Ganaleni (Abheri, Tyagaraja) |
| 191 | Dorakuna | Bilahari | Thyagaraja | no song has this title | Dorakuna Ani (Todi, Tyagaraja); Dorakuna Itani (Sama, Samanta, Annamacharya); Dorakuna Ituvanti Seva (Bilahari, Tyagaraja) |

## Notes

- Exact matching is deliberate (constitution III, never guess); closer matching is the
  phonetic-search work (T027). Two Ragas or Composers whose names fold alike are refused, so
  catalog near-duplicates (for example "Hamsadhvani" and "Hamsadvani", or "Ragamalika" beside
  "Ragamalika?") leave a typed name Unresolved. Songs listed twice with the same Raga and Composer
  leave their title Unresolved the same way.
- The sheet has no Concert dates, so every Concert in the fixture is dated 2024-12-01.
- Concert 34 has Items but no row in the Main tab, so it has no Artists or Sabha.
