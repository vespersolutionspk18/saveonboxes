# Customer app mobile redesign plan

## Direction

Make each screen feel like a clear set of physical box labels: the box number is easy to spot, its destination is immediately clear, and its contents are searchable or visible without opening every box. Keep the existing orange and navy identity, shift the workspace from warm cream to a cool light canvas, and use whitespace and quiet fills to group information. The dashboard is left-aligned and task-first; the phone layout brings search, scan, and room destination within thumb reach.

## Color tokens

| Token | Hex | Use |
| --- | --- | --- |
| Frost | `#F1F6FA` | Cool workspace canvas |
| Paper | `#FFFFFF` | Main reading surfaces and form fields |
| Navy | `#17324B` | Primary text, navigation, and strong structure |
| Brand orange | `#F36A16` | Existing mark and small identifying accents |
| Slate | `#586C7C` | Secondary copy and quiet metadata |
| Quiet | `#E7EEF5` | Low-emphasis buttons, selected filters, and input fills |

Use navy for primary buttons with white text; reserve orange for the logo, scan affordance, and small accents where contrast remains clear. Keep box headings in sentence case, such as “Box 12,” never all caps. Supporting labels target 14 px or larger.

## Type and spacing

Use Inter throughout, loaded by the shared platform stylesheet and explicitly applied inside the customer shell so storefront type cannot leak in. Use 32/38 px page titles on desktop and 28/34 px on phones, 20/26 px section titles, 16/24 px body copy and controls, 14/20 px supporting copy, and 12/16 px metadata only. Keep headings tight at about `-0.035em`, body text around `-0.015em`, and small labels at normal tracking. Use a compact 4, 8, 12, 16, 24, 32 px spacing rhythm without shrinking tap areas: phone controls stay at least 44 px high, text inputs stay at least 16 px, and the bottom navigation clears the device safe area.

## Layout concepts

Desktop uses a short top navigation, a centered workspace of about 1,200 px, and a single wide box list. A search field leads the dashboard; room and stage filters sit beside it. Each row reads as a label record: a clear box number, destination room, a contents preview or matched item, and a status. Rows are separated by spacing and quiet fills rather than rules or borders. Box detail puts the destination first and inventory next; optional name, status, notes, and flags follow as secondary details. Master list stays grouped by room and turns into a print-first sheet without app controls.

```text
SaveOnBoxes                     Boxes   Master list   Shop supplies   Log out

My boxes                                      Scan label   Print master list
[ Search every box and item __________________________ ] [Room] [Stage]
42 boxes                                      8 packed   156 items

Box 12       Kitchen                                       Packing
             Kettle, mugs, dish towels

Box 11       Bedroom                                       Packed
             Sheets, lamp, phone charger

Box 10       Hall closet                                   Unpacked
             Winter coats
```

On a phone, collapse the header to the brand mark and reachable sign-out. Keep one compact Scan label action beside the page title, place search before results, wrap the room and stage filters, then show one label record per row. A fixed bottom navigation provides Boxes, Scan label, and Master list; it uses the bottom safe-area inset. The selected tab is clear by fill and weight, not an arrow. Search results keep the matching inventory and room visible together.

```text
SaveOnBoxes

My boxes                              [Scan label]
[ Search items or box number __________ ]
[ All rooms ] [ All stages ]
42 boxes · 8 packed

Box 12
Kitchen
Kettle · Mugs · Dish towels
Packing

Box 11
Bedroom
Sheets · Lamp · Phone charger
Packed

Boxes          Scan label          Master list
```

On box detail, show `Box 12` and its destination before the inventory list, with a room control at the top. Keep adding, editing, changing quantity, and removing contents possible on a narrow screen: item controls wrap to a second row and remain at least 44 px targets. Put secondary box details after inventory. The scanner takes the full phone viewport, respects top and bottom safe areas, keeps the camera preview and primary control visible when permission help or the software keyboard appears, and retains the phone Camera-app fallback.

Authentication uses a compact single-column form on phones and a restrained two-column layout on desktop. Put the mark close to the heading and form, remove the tall empty artwork gap, keep 16 px fields and 48 px primary actions, and leave recovery links and privacy copy in normal document flow so the keyboard cannot cover them. Registration remains email, phone, and password only. The master list stays one column on phones, keeps destination headings and every item's quantity readable, and hides app navigation and print controls only in print output. A box's main name starts at its automatic `Box N` label and stays fully editable; clearing the field restores that default. The detail screen lets the customer choose an optional origin and optional destination and add a room inline without leaving the box. On desktop, inventory is a semantic Item, Photo, Quantity, and Actions table; on phones, every row stacks those same labeled cells for clear reading and thumb-sized controls. Each row contains one item and its quantity, with an optional private photo accepted as JPG, PNG, or WebP and resized before upload. The box's print action opens a plain A4 sheet containing only that box's details, room names, and an unadorned inventory table. Box details offer Save at both the top and bottom, and either Save persists all selected box fields and room choices. Use the supplied transparent `public/assets/Logo.png` through a clipped crop sized to its actual artwork, and remove the customer workspace footer and dashboard keyboard-shortcut hint.

The same small-screen system should carry through the rest of the product. The admin workspace uses a 44 px menu/drawer target, stacks dense filters and forms on phones, and contains wide data tables in a horizontal scroll region so the page itself never overflows. The storefront should use the same locally loaded Inter family and tight tracking, keep product and checkout controls reachable on narrow screens, and remove arrow glyphs from buttons and action links. Those admin and storefront changes have separate ownership; this plan records the shared direction.

## Interface principles

- Make `Box N` the most recognizable object on the screen; show its destination and contents before secondary metadata.
- Make the dashboard search the fastest way to answer “where is the kettle?” without a scan.
- Use sentence-case labels and literal action names such as “Scan a label,” “Add items,” and “Print master list.” Remove decorative eyebrows, arrow glyphs, and arrow icons from buttons and action links.
- Group with alignment, whitespace, and restrained surface color. Do not use card outlines, rules, or separator lines.
- Preserve customer role redirects, search behavior, label claiming, inventory edits, room management, password recovery, and print behavior while changing only presentation and responsive layout.

## Review against the brief

The first visual pass could have drifted toward cream paper, serif moving-box nostalgia, or a grid of identical rounded SaaS cards. The revised plan rejects those defaults: it keeps the requested cool canvas and orange/navy brand, uses label-like rows because people identify real boxes by number and room, and relies on whitespace instead of dividers to stay borderless. It also elevates the actual customer job—find an item, see its box and destination—above decorative dashboard metrics. Mobile sizing and safe-area rules protect the simple child-friendly flow, while compact desktop rows retain the requested information density.

Review targets are 320, 390, and 430 px phone widths, 768 px tablet width, and 1280 px desktop width. The customer pass checks search matches, room filtering with long names, destination-first box detail, origin and destination changes, inline room creation without leaving the box, default-name reset, one-item additions, quantity and photo edits, single-box A4 output, master-list consistency, logged-out QR continuation through login and recovery, and scanner open/close without granting camera permission.
