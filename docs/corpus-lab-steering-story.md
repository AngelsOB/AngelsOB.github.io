# How I built the flavour steering (and everything I got wrong first)

*A build story. Draft for the Learn section. Plain markdown, styling later.*

I brew. Most of my friends don't. That's really where this started. I wanted them to be able to describe a beer they were after, in whatever words they had, and for the two of us to turn that into a real recipe and actually go make it.

The first version of the idea was a lot smaller than what it turned into. I just wanted to pick a style and quickly get a decent template for it. A mean brew. Something that shows you roughly what goes into a hazy IPA, or a dark lager, so you're starting from a sane place instead of a blank page. No AI writing anything. Just real recipes, averaged into a sensible starting point.

So that's what I built first. I had a big archive of homebrew recipes people had shared, somewhere around 180,000 of them. I turned each one into a short list of numbers: how much of each flavour it has (grainy, caramel, roast, citrus, tropical, and so on), plus its basic stats like color, bitterness, and strength. That gives you a kind of map, where similar beers land near each other. Stouts in one corner, pale lagers in another. Pick a style, grab the recipes nearest to it, average them, build one clean recipe out of that, and run it through the app's real brewing math so the numbers aren't made up.

That part worked. You could pick a style and get a reasonable template for it. Good enough to hand a friend and say "this is basically what goes into a porter."

## Where the dial came from

I didn't set out to build a flavour wheel you could steer. That snuck up on me.

I already had a little hop flavour visualizer in the builder, a radar chart that shows what a hop bill actually tastes like. At some point I started pointing it at the templates, just to see what each style's hops looked like laid out. Then I built the same kind of chart for the grain side. And sitting there looking at those two radars for a style, the obvious thought showed up: it would be really cool if I could just grab one of these and pull it toward what I actually want to come out.

That's the whole tool, really. The template was the point. The steering was me staring at the template and wanting to push on it.

The first time I tried pushing one of those wheels for real, the result often didn't taste like what I'd asked for. Which was annoying, and also the whole reason everything below exists.

## The thing I didn't understand at first

Here's what I'd actually built without realizing it: a search engine. Not a recipe writer.

When you push "more berry," all that does is move where I look on the map. Then I copy the most common ingredients from the recipes I land near. Nothing in that process ever tries to hit "more berry." It just wanders toward that area and copies whatever's popular there, which is usually a watered-down version of what you asked for.

Once I said that out loud, every fix after it was obvious. I needed the target to shape the actual recipe, not just pick where to shop.

## Fix one: build a few, keep the best

Instead of building one recipe and shipping it, I build a batch. All from real ingredients, all slightly different. Then I check each one against the flavour model and keep the one closest to what you asked for.

It's a small change but it's the whole idea in miniature. The old single recipe is always in the batch, so this can only ever match it or beat it. Never worse.

That alone cut the miss by a good chunk.

## Fix two: it's the amounts, not the ingredient

The batch trick has a ceiling. It can swap which caramel malt you use, but it can't change how much. And flavour is mostly about how much. If none of the nearby recipes use much caramel malt, no amount of shuffling gives you a caramel-forward beer.

So after picking the best batch, I added a step that nudges the grain bill directly. Short on caramel? Add a bit more of a caramel grain.

My first version of this was dumb in a specific way. To add caramel it grabbed crystal malt. To add honey it grabbed honey malt. The strongest lever, every time. That is not how anyone actually brews. A brewer reaches for the gentlest grain that gets the job done and only breaks out the heavy specialty stuff when they have to.

So I made it climb a ladder. Start near the base malts. Reach for the big flavour grains only when the gentle ones can't get there. Now a honey push leans on vienna and munich, and honey malt barely shows up unless you crank it. That one change fixed a lot of "why is there weird malt in my beer."

(There was a good bug in here. Because adding a grain rescales the whole bill, a grain that had "maxed out" would quietly drop back under its limit and get picked again, so the ladder just kept topping up the same gentle grain forever instead of climbing. Took me a while to see it.)

## Fix three: don't ask for two rare things at once

Roasty malt is normal. Tropical hops are normal. Roasty *and* tropical in the same beer basically doesn't exist. So when I pushed both, my search landed in a dead zone with almost no real recipes in it, and it copied whatever weird outliers happened to be nearby.

The fix was to stop treating the beer as one search. I look for the grain and the hops separately. Grain from real roasty beers. Hops from real tropical beers. Then I combine them at the end. If you don't push both, the two searches quietly land in the same place and nothing changes. It only splits apart when you deliberately ask for a combination nobody actually makes.

## Fix four: bring back the variety

Picking the single best every time created a boring problem. "Another take" gave you almost the same recipe. But I was already building a dozen good options each time and throwing eleven of them away.

So now reroll walks through the runners-up instead of re-finding the winner.

And I changed my mind on something while doing this. I'd been treating variation as noise to stamp out. It isn't. A slightly-off roll is character. It's the thing that lets you stumble onto a recipe you wouldn't have designed on purpose. I don't want this to feel like a vending machine that spits out the one correct answer.

## Fix five: the crystal thing (where it gets good)

Crystal malt kept showing up in hazy IPAs. It shouldn't. Modern hazies don't use it. I was sure I knew why, and I was wrong three times.

First I assumed the "add more grain" step was sneaking it in. So I turned that step off. Still there.

Then I assumed I was over-including a rare grain. So I went and actually looked at the data, and it turned out a lot of the older IPA recipes genuinely do use crystal. I was copying them faithfully. Not a bug.

The real problem was quieter. When I searched for a hazy, I wasn't only getting hazies. The search pulled in whatever was closest by taste, and a bunch of crystal-heavy regular IPAs were close enough to slip in. Only about 15 of my 40 neighbours were actually hazies. The rest were bleeding their crystal into the result.

So I locked the search to the real style, and only let it wander outside the style when you push it somewhere the style genuinely can't go (roast on a hazy, say). Now a hazy is built from hazies.

Then it happened again, worse, with American light lagers. And this one confused me because a light lager is fully locked to its style and has thousands of recipes behind it. There was no pollution to blame.

So I looked at the recipes people had actually labeled "American Light Lager." Two thirds of them are too dark to be light lagers. People mislabel their recipes constantly. So the "average light lager" I was computing was mostly not light lagers at all. That's why it had crystal.

The fix was to throw out recipes that break their own style's color range before I average them. A "light lager" that's amber-colored isn't one, no matter what someone typed in the box. I kept a generous buffer on it so real variation and style drift still get through, since brewers absolutely push style boundaries and I don't want to hard-lock anyone into a rulebook. After that, the crystal went to zero.

The lesson I keep coming back to from all of this: don't trust the labels. Check whether the thing you're averaging is even what it claims to be.

## Did any of it actually help

I didn't want to just believe it was better, so I measured it. I ran the naive version and each layer against the recipes themselves, on three things: how much off-style grain sneaks in, how often the flavours land inside the style's real range, and how close a push gets to what you asked for.

```
version           off-style grain   in-style flavour   push accuracy (lower is better)
naive                  1.1%              75%                0.188
+ lock to style        0.3%              99%                0.161
+ build-and-pick       0.3%              99%                0.175
+ nudge amounts        0.3%              99%                0.088
+ split search         0.3%              99%                0.088
```

Reading that top to bottom is basically the story of the build. Locking to the style is what cleaned up the off-style junk and made the recipes actually look like the style. Nudging the amounts is what made pushes land. Building-and-picking is roughly flat on accuracy on purpose, because that's where the variety comes from, and I decided variety was worth a hair of accuracy. Splitting the search doesn't show up here because this test doesn't push two rare things at once, which is the only time it matters.

## What it isn't

A few honest notes, because I'd rather say them than have someone assume.

There are no taste-test results behind this. "Better" means closer to what real recipes of that style look like, not that a panel of judges preferred it. That's a proxy and I know it.

The data has an era to it. It leans toward how people brewed a while back, so its idea of an "American IPA" is more caramel-heavy than a modern one. The tool honestly reflects its data. Making it match today's taste would mean layering my own opinion on top, and I've tried to keep that separate.

The flavour model is a map, not a lab instrument. Its job is to put similar beers near each other, not to be chemically exact. Some of any miss is the map being fuzzy, not the recipe being wrong.

And the occasional odd roll is on purpose. Some real hazies do use a touch of crystal, so once in a while you'll get one. That's the tool having a little character instead of being sterile, and I'd rather keep that.
