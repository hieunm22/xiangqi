setup-env:
	yarn
	git checkout HEAD -- yarn.lock

reset:
	rm -rf dist
	rm -rf node_modules
	rm -rf coverage
	rm -f .env.local
	git reset --hard

destroy:
	docker container stop chess
	docker container rm chess
	docker image rm chess

docker:
	docker build -t chess -f Dockerfile .
	docker run --name chess -ditp 7777:80 --restart unless-stopped chess
	rm -rf dist

publish:
	yarn build
	make destroy
	make docker

start:
	make setup-env
	yarn dev

package:
	yarn
	git checkout HEAD -- yarn.lock
	yarn dev
