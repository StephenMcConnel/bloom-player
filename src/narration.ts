import LiteEvent from "./event";

// Handles implemenation of narration, including playing the audio and
// highlighting the currently playing text.
// Enhance: There's code here to support PageNarrationComplete for auto-advance,
// but that isn't implemented yet so it may not be complete.
// May need to copy more pieces from old BloomPlayer.
// Enhance: Pause is a prop for this control, but somehow we need to
// notify the container if we are paused forcibly by Chrome refusing to
// let us play until the user interacts with the page.
export default class Narration {
    private playerPage: HTMLElement;
    private idOfCurrentSentence: string;
    private playingAll: boolean;
    private paused: boolean = false;
    public urlPrefix: string;
    // The time we started to play the current page (set in computeDuration, adjusted for pauses)
    private startPlay: Date;
    private startPause: Date;
    private fakeNarrationAborted: boolean = false;
    private segmentIndex: number;

    private segments: HTMLElement[];

    // The first one to play should be at the end for both of these
    private elementsToPlayConsecutivelyStack: HTMLElement[];
    private timingsStack: number[];

    public PageNarrationComplete: LiteEvent<HTMLElement>;
    public PageDurationAvailable: LiteEvent<HTMLElement>;
    public PageDuration: number;

    public playAllSentences(page: HTMLElement): void {
        this.playerPage = page;
        const audioElts = this.getPageAudioElements();
        const original: Element | null = page.querySelector(".ui-audioCurrent");
        for (let firstIndex = 0; firstIndex < audioElts.length; firstIndex++) {
            const first = audioElts[firstIndex];
            if (!this.canPlayAudio(first)) {
                continue;
            }

            const timingsStr: string | null = first.getAttribute("data-audioRecordingTimings");

            let nextElementToHighlight = first;
            //const timings: number[] = [];

            if (timingsStr) {
                const fields = timingsStr.split(" ");
                this.timingsStack = [];
                for (let i = fields.length - 1; i >= 0; --i) {
                    //timings[i] = Number(fields[i]);
                    this.timingsStack.push(Number(fields[i]));
                }
                const childSpanElements = first.getElementsByTagName("span");

                this.elementsToPlayConsecutivelyStack = [];
                for (let i = childSpanElements.length - 1; i >= 0 ; --i) {
                    this.elementsToPlayConsecutivelyStack.push(childSpanElements.item(i)!);
                }
                if (childSpanElements && childSpanElements.length > 0) {
                    nextElementToHighlight = childSpanElements.item(0)!;
                }
            }

            this.setCurrentSpan(original, nextElementToHighlight);

            // TODO: Replace me with a more sophisticated version
            // for (let i = 1; i < timings.length; ++i) {
            //     const childSpanElements = first.getElementsByTagName("span");

            //     setTimeout(() => {
            //         this.setCurrentSpan(original, childSpanElements.item(i)!, false);
            //     }, timings[i] * 1000);
            // }

            this.playingAll = true;
            //this.setStatus("listen", Status.Active);
            this.playCurrentInternal();
            return;
        }
        // Nothing to play
        if (this.PageNarrationComplete) {
            this.PageNarrationComplete.raise();
        }
    }

    private playCurrentInternal() {
        if (!this.paused && this.getPlayer()) {
            const promise = this.getPlayer().play();

            for (let i = this.timingsStack.length - 1; i >= 0; --i) {
                setTimeout( () => {
                    this.setCurrentSpan(null, this.elementsToPlayConsecutivelyStack[i], false);
                }, this.timingsStack[i] * 1000);
            }


            // In newer browsers, play() returns a promise which fails
            // if the browser disobeys the command to play, as some do
            // if the user hasn't 'interacted' with the page in some
            // way that makes the browser think they are OK with it
            // playing audio. In Gecko45, the return value is undefined,
            // so we mustn't call catch.
            if (promise && promise.catch) {
                promise.catch((reason: any) => {
                    console.log("could not play sound: " + reason);

                    // REVIEW: Don't think the following code is needed?
                    // If the promise fails, shouldn't the error handler go at it?
                    // Well, definitely don't want removeAudioCurrent(). That'll mess up the playEnded() call.
                    // Maybe pausing it isn't a terrible idea.

                    // this.removeAudioCurrent();
                    // With some kinds of invalid sound file it keeps trying and plays over and over.

                    // REVIEW: I don't think this line actually helps anything, so I commented it out.
                    // this.getPlayer().pause();
                    // if (this.Pause) {
                    //     this.Pause.raise();
                    // }
                });
            }
        }
    }

    private removeAudioCurrent() {
        const elts = document.getElementsByClassName("ui-audioCurrent");
        for (let i = 0; i < elts.length; i++) {
            elts[i].classList.remove("ui-audioCurrent");
        }
    }

    private setCurrentSpan(
        current: Element | null,
        changeTo: HTMLElement | null,
        isUpdateAudioPlayerOn: boolean = true
    ): void {
        this.removeAudioCurrent();
        if (changeTo) {
            changeTo.classList.add("ui-audioCurrent");
            this.idOfCurrentSentence = changeTo.getAttribute("id") || "";
        }
        if (isUpdateAudioPlayerOn) {
            this.updatePlayerStatus();
        }
        //this.changeStateAndSetExpected("record");
    }

    private updatePlayerStatus() {
        const player = this.getPlayer();
        if (!player) {
            return;
        }
        player.setAttribute(
            "src",
            this.currentAudioUrl(this.idOfCurrentSentence) +
                "?nocache=" +
                new Date().getTime()
        );
    }

    private currentAudioUrl(id: string): string {
        return this.urlPrefix + "/audio/" + id + ".mp3";
    }

    private getPlayer(): HTMLMediaElement {
        return this.getAudio("bloom-audio-player", audio => {
            // if we just pass the function, it has the wrong "this"
            audio.addEventListener("ended", () => this.playEnded());
            audio.addEventListener("error", () => this.playEnded());
        });
    }

    public playEnded(): void {
        if (this.playingAll) {
            const current: Element | null = this.playerPage.querySelector(
                ".ui-audioCurrent"
            );
            const audioElts = this.getPageAudioElements();
            let nextIndex = audioElts.indexOf(current as HTMLElement) + 1;
            while (nextIndex < audioElts.length) {
                const next = audioElts[nextIndex];
                if (!this.canPlayAudio(next)) {
                    nextIndex++;
                    continue;
                }
                this.setCurrentSpan(current, next);
                //this.setStatus("listen", Status.Active); // gets returned to enabled by setCurrentSpan
                this.playCurrentInternal();
                return;
            }
            this.playingAll = false;
            this.setCurrentSpan(current, null);
            if (this.PageNarrationComplete) {
                this.PageNarrationComplete.raise(this.playerPage);
            }
            //this.changeStateAndSetExpected("listen");
            return;
        }
        //this.changeStateAndSetExpected("next");
    }

    private getAudio(id: string, init: (audio: HTMLAudioElement) => void) {
        let player: HTMLAudioElement | null = document.querySelector(
            "#" + id
        ) as HTMLAudioElement;
        if (player && !player.play) {
            player.remove();
            player = null;
        }
        if (!player) {
            player = document.createElement("audio") as HTMLAudioElement;
            player.setAttribute("id", id);
            document.body.appendChild(player);
            init(player);
        }
        return player as HTMLMediaElement;
    }

    public canPlayAudio(current: Element): boolean {
        return true; // currently no way to check
    }

    // Returns all elements that match CSS selector {expr} as an array.
    // Querying can optionally be restricted to {container}’s descendants
    // If includeSelf is true, it includes both itself as well as its descendants.
    // Otherwise, it only includes descendants.
    private findAll(
        expr: string,
        container: HTMLElement,
        includeSelf: boolean = false
    ): HTMLElement[] {
        // querySelectorAll checks all the descendants
        const allMatches: HTMLElement[] = [].slice.call(
            (container || document).querySelectorAll(expr)
        );

        // Now check itself
        if (includeSelf && container && container.matches(expr)) {
            allMatches.push(container);
        }

        return allMatches;
    }

    private getRecordableDivs(container: HTMLElement) {
        return this.findAll("div.bloom-editable.bloom-content1", container);
    }

    // Optional param is for use when 'playerPage' has NOT been initialized.
    // Not using the optional param assumes 'playerPage' has been initialized
    private getPageRecordableDivs(page?: HTMLElement): HTMLElement[] {
        return this.getRecordableDivs(page ? page : this.playerPage);
    }

    // Optional param is for use when 'playerPage' has NOT been initialized.
    // Not using the optional param assumes 'playerPage' has been initialized
    private getPageAudioElements(page?: HTMLElement): HTMLElement[] {
        return [].concat.apply(
            [],
            this.getPageRecordableDivs(page).map(x =>
                this.findAll(".audio-sentence", x, true)
            )
        );
    }

    public play() {
        if (!this.paused) {
            return; // no change.
        }
        // I'm not sure how getPlayer() can return null/undefined, but have seen it happen
        // typically when doing something odd like trying to go back from the first page.
        if (this.segments.length && this.getPlayer()) {
            this.getPlayer().play();
        }
        this.paused = false;
        // adjust startPlay by the elapsed pause. This will cause fakePageNarrationTimedOut to
        // start a new timeout if we are depending on it to fake PageNarrationComplete.
        const pause = new Date().getTime() - this.startPause.getTime();
        this.startPlay = new Date(this.startPlay.getTime() + pause);
        //console.log("paused for " + pause + " and adjusted start time to " + this.startPlay);
        if (this.fakeNarrationAborted) {
            // we already paused through the timeout for normal advance.
            // This call (now we are not paused and have adjusted startPlay)
            // will typically start a new timeout. If we are very close to
            // the desired duration it may just raise the event at once.
            // Either way we should get the event raised exactly once
            // at very close to the right time, allowing for pauses.
            this.fakeNarrationAborted = false;
            this.fakePageNarrationTimedOut(this.playerPage);
        }
    }

    public pause() {
        if (this.paused) {
            return;
        }
        if (this.segments.length && this.getPlayer()) {
            this.getPlayer().pause();
        }
        this.paused = true;
        this.startPause = new Date();
    }

    public computeDuration(page: HTMLElement): void {
        this.playerPage = page;
        this.segments = this.getPageAudioElements();
        this.PageDuration = 0.0;
        this.segmentIndex = -1; // so pre-increment in getNextSegment sets to 0.
        this.startPlay = new Date();
        //console.log("started play at " + this.startPlay);
        // in case we are already paused (but did manual advance), start computing
        // the pause duration from the beginning of this page.
        this.startPause = this.startPlay;
        if (this.segments.length === 0) {
            this.PageDuration = 3.0;
            if (this.PageDurationAvailable) {
                this.PageDurationAvailable.raise(page);
            }
            // Since there is nothing to play, we will never get an 'ended' event
            // from the player. If we are going to advance pages automatically,
            // we need to raise PageNarrationComplete some other way.
            // A timeout allows us to raise it after the arbitrary duration we have
            // selected. The tricky thing is to allow it to be paused.
            setTimeout(
                () => this.fakePageNarrationTimedOut(page),
                this.PageDuration * 1000
            );
            this.fakeNarrationAborted = false;
            return;
        }
        // trigger first duration evaluation. Each triggers another until we have them all.
        this.getNextSegment();
        //this.getDurationPlayer().setAttribute("src", this.currentAudioUrl(this.segments[0].getAttribute("id")));
    }

    private getNextSegment() {
        this.segmentIndex++;
        if (this.segmentIndex < this.segments.length) {
            const attrDuration = this.segments[this.segmentIndex].getAttribute(
                "data-duration"
            );
            if (attrDuration) {
                // precomputed duration available, use it and go on.
                this.PageDuration += parseFloat(attrDuration);
                this.getNextSegment();
                return;
            }
            // Replace this with the commented code to have ask the browser for duration.
            // (Also uncomment the getDurationPlayer method)
            // However, this doesn't work in apps.
            this.getNextSegment();
            // this.getDurationPlayer().setAttribute("src",
            //     this.currentAudioUrl(this.segments[this.segmentIndex].getAttribute("id")));
        } else {
            if (this.PageDuration < 3.0) {
                this.PageDuration = 3.0;
            }
            if (this.PageDurationAvailable) {
                this.PageDurationAvailable.raise(this.playerPage);
            }
        }
    }

    private fakePageNarrationTimedOut(page: HTMLElement) {
        if (this.paused) {
            this.fakeNarrationAborted = true;
            return;
        }
        // It's possible we experienced one or more pauses and therefore this timeout
        // happened too soon. In that case, this.startPlay will have been adjusted by
        // the pauses, so we can detect that here and start a new timeout which will
        // occur at the appropriately delayed time.
        const duration =
            (new Date().getTime() - this.startPlay.getTime()) / 1000;
        if (duration < this.PageDuration - 0.01) {
            // too soon; try again.
            setTimeout(
                () => this.fakePageNarrationTimedOut(page),
                (this.PageDuration - duration) * 1000
            );
            return;
        }
        if (this.PageNarrationComplete) {
            this.PageNarrationComplete.raise(page);
        }
    }
}
