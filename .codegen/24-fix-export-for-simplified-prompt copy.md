# Context:
Clicking the export button on a saved property exports it to csv. The exported format is wrong.

# Details:

The "🤖 Full ChatGPT Analysis" section of a saved property, which is used as input to the csv export, looks like this:
"| Property Data | Value |
| --- | --- |
| Price | ₪1,540,000 |
| Location | דירה בחולון |
| Estimated Rent | Not specified |
| Number of Rooms | 4 |"

Exported data looks like this:
"Property URL	Domain	Analysis Date	Property Data	Value
https://www.yad2.co.il/realestate/item/tlip9ed1?opened-from=item&component-type=carousel&component-header=%D7%A0%D7%9B%D7%A1%D7%99%D7%9D%20%D7%A0%D7%95%D7%A1%D7%A4%D7%99%D7%9D%20%D7%A9%D7%9C%20%D7%94%D7%9E%D7%A9%D7%A8%D7%93&spot=standard&location=3	www.yad2.co.il	9/13/2025	Price	‚Ç™1,540,000
https://www.yad2.co.il/realestate/item/tlip9ed1?opened-from=item&component-type=carousel&component-header=%D7%A0%D7%9B%D7%A1%D7%99%D7%9D%20%D7%A0%D7%95%D7%A1%D7%A4%D7%99%D7%9D%20%D7%A9%D7%9C%20%D7%94%D7%9E%D7%A9%D7%A8%D7%93&spot=standard&location=3	www.yad2.co.il	9/13/2025	Location	◊©"◊ô ◊¢◊í◊†◊ï◊ü 33, ◊ß◊®◊ô◊™ ◊ê◊ú◊ô◊¢◊ñ◊®, ◊ó◊ô◊§◊î
https://www.yad2.co.il/realestate/item/tlip9ed1?opened-from=item&component-type=carousel&component-header=%D7%A0%D7%9B%D7%A1%D7%99%D7%9D%20%D7%A0%D7%95%D7%A1%D7%A4%D7%99%D7%9D%20%D7%A9%D7%9C%20%D7%94%D7%9E%D7%A9%D7%A8%D7%93&spot=standard&location=3	www.yad2.co.il	9/13/2025	Estimated Rent	Not specified
https://www.yad2.co.il/realestate/item/tlip9ed1?opened-from=item&component-type=carousel&component-header=%D7%A0%D7%9B%D7%A1%D7%99%D7%9D%20%D7%A0%D7%95%D7%A1%D7%A4%D7%99%D7%9D%20%D7%A9%D7%9C%20%D7%94%D7%9E%D7%A9%D7%A8%D7%93&spot=standard&location=3	www.yad2.co.il	9/13/2025	Number of Rooms	4 ◊ó◊ì◊®◊ô◊ù"

The problem with that is that for every "Property Data" there is a new line, creating multiple lines for the same property.

# Expected:

Link | Price | Location | Estimated Rent | Number of Rooms
https://www.yad2.co.il/realestate/item/tlip9ed1?opened-from=item&component-type=carousel&component-header=%D7%A0%D7%9B%D7%A1%D7%99%D7%9D%20%D7%A0%D7%95%D7%A1%D7%A4%D7%99%D7%9D%20%D7%A9%D7%9C%20%D7%94%D7%9E%D7%A9%D7%A8%D7%93&spot=standard&location=3 | 1,540,000 | דירה בחולון | Not specified | 4


Here, the "Property Data" is the columns names and the "Value" is the values for each property.

# requirements:
- The exported CSV should follow the expected format.
- The column names and values should be extracted from the "🤖 Full ChatGPT Analysis" section.

# Tasks:
- [ ] Update the csv export function to show each property data on one line.




