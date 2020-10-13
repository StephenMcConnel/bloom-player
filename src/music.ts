import LiteEvent from "./event";

// class Music contains functionality to get background music to play properly in bloom-player

export class Music {
    public urlPrefix: string;
    public PlayFailed: LiteEvent<HTMLElement>;

    private paused: boolean = false;
    private currentPage: HTMLDivElement;
    private playingBackgroundAudio: string; // data-backgroundaudio currently playing
    private playingBackgroundAudioPage: string; // corresponding data-page-number or data-xmatter-page

    public static documentHasMusic(): boolean {
        return [].slice
            .call(document.body.getElementsByClassName("bloom-page"))
            .find((p: HTMLElement) => Music.pageHasMusic(p));
    }

    public static pageHasMusic(page: HTMLElement): boolean {
        return page.attributes["data-backgroundaudio"];
    }

    public HandlePageVisible(bloomPage: HTMLElement) {
        this.currentPage = bloomPage as HTMLDivElement;
        if (this.currentPage && Music.pageHasMusic(this.currentPage)) {
            this.listen();
        }
    }

    public hidingPage() {
        // music continues on the next page by default.
    }

    private listen() {
        this.setMusicSourceAndVolume();
        if (this.paused) {
            this.getPlayer().pause();
        } else {
            this.playerPlay();
        }
    }

    public play() {
        if (!this.currentPage) {
            return;
        }
        this.playerPlay();
        this.paused = false;
    }

    public pause() {
        if (!this.currentPage) {
            return;
        }
        this.getPlayer().pause();
        this.paused = true;
    }

    private getPlayer(): HTMLAudioElement {
        let player = document.querySelector(
            "#music-player"
        ) as HTMLAudioElement;
        if (!player) {
            player = document.createElement("audio") as HTMLAudioElement;
            if (!this.currentPage) {
                console.log(
                    "Music.getPlayer() called when currentPage wasn't set."
                );
                player.volume = 1;
            } else {
                const volume = this.currentPage.attributes[
                    "data-backgroundaudiovolume"
                ];
                player.volume = volume && volume.value ? volume.value : 1;
            }
            player.setAttribute("id", "music-player");
            document.body.appendChild(player);

            // if we just pass the function, it has the wrong "this"
            player.addEventListener("ended", () => this.playEnded());
        }
        return player as HTMLAudioElement;
    }

    // Gecko has no way of knowing that we've created or modified the audio file,
    // so it will cache the previous content of the file or
    // remember if no such file previously existed. So we add a bogus query string
    // based on the current time so that it asks the server for the file again.
    private setMusicSourceAndVolume(): void {
        const music = this.currentPage.attributes["data-backgroundaudio"].value;
        const page = this.getPageNumberOrLabel();
        if (
            music === this.playingBackgroundAudio &&
            page === this.playingBackgroundAudioPage
        ) {
            // We've returned to the page that established the currently playing
            // background audio.  We don't want to reset the audio src because that
            // starts over from the beginning.  Once started we want a continuous
            // stream until another source is chosen in the book.  On the other hand,
            // if the user explicitly uses the same audio file again then presumably
            // the desire is to start from the beginning again.
            return;
        }
        const url = this.currentMusicUrl(
            music + "?nocache=" + new Date().getTime()
        );
        // console.log(
        //     "DEBUG: Music.setMusicSource() src = '" +
        //         (music ? url : music) +
        //         "'"
        // );
        const player = this.getPlayer();
        player.setAttribute("src", music ? url : "");
        this.playingBackgroundAudio = music;
        this.playingBackgroundAudioPage = page;
        const volume = this.getMusicVolume();
        if (volume.length) {
            player.volume = Number(volume);
        }
    }

    private getMusicVolume(): string {
        if (!this.currentPage) {
            return "";
        }
        const volume = this.currentPage.getAttribute(
            "data-backgroundaudiovolume"
        );
        if (!volume) {
            return "";
        }
        return volume;
    }

    private getPageNumberOrLabel(): string {
        if (!this.currentPage) {
            return "";
        }
        const dataPageNumber = this.currentPage.getAttribute(
            "data-page-number"
        );
        if (dataPageNumber) {
            return dataPageNumber;
        }
        const dataXmatterPage = this.currentPage.getAttribute(
            "data-xmatter-page"
        );
        if (dataXmatterPage) {
            return dataXmatterPage;
        }
        return "";
    }

    private currentMusicUrl(filename: string): string {
        return this.urlPrefix + "/audio/" + filename;
    }

    private playEnded() {
        // just start playing all over again.
        this.getPlayer().currentTime = 0;
        this.play();
    }

    private playerPlay() {
        const promise = this.getPlayer().play();

        // In newer browsers, play() returns a promise which fails
        // if the browser disobeys the command to play, as some do
        // if the user hasn't 'interacted' with the page in some
        // way that makes the browser think they are OK with it
        // playing audio. In Gecko45, the return value is undefined,
        // so we mustn't call catch.
        if (promise && promise.catch) {
            promise.catch((reason: any) => {
                console.log("could not play music: " + reason);

                // With some kinds of invalid sound file it keeps trying and plays over and over.
                this.getPlayer().pause();

                // Get all the state (and UI) set correctly again
                // Note that we don't want to do this if, for example, we asked the player to play
                // but hadn't actually configured any music to play, as easily happens when the
                // user clicks Play but the book has no music. We only want to do it if the thing
                // stopping us is the lack of user interaction.
                if (reason.name === "NotAllowedError" && this.PlayFailed) {
                    this.PlayFailed.raise();
                }
            });
        }
    }
}
