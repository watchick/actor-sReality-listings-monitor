# sReality Listings Monitor

Search and monitor sReality listings

## Usage

Enter location in free-form, as well as operation and object type. You could also specify relevant subtypes depending on object type. The actor also supports price and area filters. To be notified of new listings (or when the listings matching your criteria were changed or removed) provide your email address. Since it uses Puppeteer, the minimum memory for running is 2048 MB.

_This actor does not extract/save any of the found listing's data except the link to the listing itself. Actor only helps you to automate your search. After the initial run, you could run it with the same input to monitor the changes. You will be notified in case previously found listing would be removed or other matching listings would be found._

## Input

`location`, `offerType` and `type` are required. All other input properties are optional.

## Output

Once the actor finishes, it will save found listings URLs to the Key-Value store.
If there was an email provided on input - it would send a notification to provided email (providing information whether some listings matching criteria on input were found or not, as well as matching listings changed or were removed). It would also include listings URLs.
