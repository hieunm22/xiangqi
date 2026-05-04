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
	docker container stop xiangqi-web
	docker container rm xiangqi-web
	docker image rm xiangqi-web

docker:
	docker build -t xiangqi-web -f Dockerfile .
	docker run --name xiangqi-web -ditp 3004:80 --restart unless-stopped xiangqi-web

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
