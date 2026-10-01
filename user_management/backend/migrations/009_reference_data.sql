-- Reference data is selected by users and stored as foreign keys; registrations
-- never create departments or hostels from free-form input.
INSERT INTO departments (name, code, school)
SELECT v.name, v.code, v.school
FROM (VALUES
 ('Department of Computer Sciences','CS','School of Technology, Communication and Management'),
 ('Department of Tourism Management','TM','School of Technology, Communication and Management'),
 ('Department of Journalism & Mass Communication','JMC','School of Technology, Communication and Management'),
 ('Department of Animation and Visual Effects','AVE','School of Technology, Communication and Management'),
 ('Department of Rural Management','RM','School of Biological Sciences and Sustainability'),
 ('Department of Environmental Science','ES','School of Biological Sciences and Sustainability'),
 ('Department of Education','EDU','School of Education, Humanities and Social Sciences'),
 ('Department of Psychology','PSY','School of Education, Humanities and Social Sciences'),
 ('Department of English','ENG','School of Education, Humanities and Social Sciences'),
 ('Department of Sanskrit and Vedic Studies','SVS','School of Indology'),
 ('Department of Hindi','HIN','School of Indology'),
 ('Department of History and Indian Culture','HIC','School of Indology'),
 ('Department of Indian Classical Music','ICM','School of Indology'),
 ('Department of Oriental Studies, Religious Studies & Philosophy','OSR','School of Indology'),
 ('Department of Yogic Sciences and Human Consciousness','YSH','School of Indology')
) AS v(name, code, school)
WHERE NOT EXISTS (SELECT 1 FROM departments d WHERE lower(d.name) = lower(v.name));
-- Initial selectable residences. Administrators may add further reference rows;
-- user registration always uses their IDs rather than creating rows itself.
INSERT INTO hostels (name, code)
SELECT v.name, v.code
FROM (VALUES
 ('Arvind', 'ARVIND'),
 ('Paninni', 'PANINNI'),
 ('Shanghmitra', 'SHANGHMITRA'),
 ('Nivedita', 'NIVEDITA'),
 ('International', 'INTERNATIONAL')
) AS v(name, code)

WHERE NOT EXISTS (SELECT 1 FROM hostels h WHERE lower(h.name) = lower(v.name));
